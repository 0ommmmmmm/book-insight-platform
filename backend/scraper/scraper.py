"""
Book Scraper using Selenium + BeautifulSoup.

Supports multiple sources:
  - books.toscrape.com (safe practice site, always available)
  - Open Library (openlibrary.org)
  - Generic fallback using meta tags

Design: Each source has its own extractor function.
The scraper auto-detects source from URL and routes accordingly.
"""

import re
import time
import logging
from dataclasses import dataclass, field
from typing import Optional
from urllib.parse import urlparse

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, WebDriverException
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)


@dataclass
class ScrapedBook:
    """Raw scraped data before DB storage."""
    title: str = ""
    author: str = ""
    rating: Optional[float] = None
    description: str = ""
    book_url: str = ""
    cover_url: str = ""
    genres: list = field(default_factory=list)
    pages: Optional[int] = None
    published_year: Optional[int] = None


def _build_driver() -> webdriver.Chrome:
    """
    Create a headless Chrome WebDriver.
    Configured for server environments (no GPU, no sandbox).
    """
    options = Options()
    options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    options.add_argument("--window-size=1920,1080")
    options.add_argument(
        "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    )
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_experimental_option("excludeSwitches", ["enable-automation"])

    service = Service()  # Uses chromedriver from PATH
    driver = webdriver.Chrome(service=service, options=options)
    driver.set_page_load_timeout(30)
    return driver


def _parse_rating_word(word: str) -> Optional[float]:
    """Convert Goodreads-style word ratings to float."""
    mapping = {
        "one": 1.0, "two": 2.0, "three": 3.0, "four": 4.0, "five": 5.0
    }
    return mapping.get(word.lower())


# ── Source-specific extractors ────────────────────────────────────────────────

def _scrape_books_toscrape(soup: BeautifulSoup, url: str) -> ScrapedBook:
    """
    Scrape from books.toscrape.com
    A legal practice scraping site, great for demos.
    """
    book = ScrapedBook(book_url=url)

    book.title = (
        soup.select_one("h1")
        and soup.select_one("h1").get_text(strip=True)
        or "Unknown Title"
    )
    book.author = "Various Authors"  # toscrape doesn't show authors on book page

    # Rating: stored as class like "star-rating Three"
    rating_el = soup.select_one(".star-rating")
    if rating_el:
        classes = rating_el.get("class", [])
        for cls in classes:
            parsed = _parse_rating_word(cls)
            if parsed:
                book.rating = parsed
                break

    # Description
    desc_el = soup.select_one("#product_description + p")
    if not desc_el:
        desc_el = soup.select_one(".product_description + p")
    if desc_el:
        book.description = desc_el.get_text(strip=True)

    # Cover image
    img = soup.select_one(".item.active img")
    if img and img.get("src"):
        # Fix relative URL
        book.cover_url = "https://books.toscrape.com/" + img["src"].lstrip("../")

    # Genre from breadcrumb
    breadcrumbs = soup.select(".breadcrumb li")
    if len(breadcrumbs) >= 3:
        book.genres = [breadcrumbs[-2].get_text(strip=True)]

    return book


def _scrape_openlibrary(soup: BeautifulSoup, url: str) -> ScrapedBook:
    """Scrape from openlibrary.org book pages."""
    book = ScrapedBook(book_url=url)

    # Title
    h1 = soup.select_one("h1.work-title, h1.title")
    if h1:
        book.title = h1.get_text(strip=True)

    # Author
    author_el = soup.select_one(".author-name, .credits a")
    if author_el:
        book.author = author_el.get_text(strip=True)

    # Description
    desc_el = soup.select_one(".work-description-content, #book-description-excerpt")
    if desc_el:
        book.description = desc_el.get_text(strip=True)

    # Cover
    img = soup.select_one(".cover-image img, .book-cover img")
    if img and img.get("src"):
        src = img["src"]
        if src.startswith("//"):
            src = "https:" + src
        book.cover_url = src

    # Subjects/genres
    subjects = soup.select(".subject-tag")
    book.genres = [s.get_text(strip=True) for s in subjects[:3]]

    return book


def _scrape_generic(soup: BeautifulSoup, url: str, driver: webdriver.Chrome) -> ScrapedBook:
    """
    Generic fallback scraper using Open Graph / schema.org tags.
    Works on many book websites.
    """
    book = ScrapedBook(book_url=url)

    # Title: try OG tag first, then schema.org, then h1
    og_title = soup.find("meta", {"property": "og:title"})
    if og_title and og_title.get("content"):
        book.title = og_title["content"].strip()
    else:
        h1 = soup.select_one("h1")
        if h1:
            book.title = h1.get_text(strip=True)

    # Description
    og_desc = soup.find("meta", {"property": "og:description"})
    if og_desc and og_desc.get("content"):
        book.description = og_desc["content"].strip()

    # Cover image
    og_image = soup.find("meta", {"property": "og:image"})
    if og_image and og_image.get("content"):
        book.cover_url = og_image["content"].strip()

    # Author from schema.org
    schema_author = soup.find("span", {"itemprop": "author"})
    if schema_author:
        book.author = schema_author.get_text(strip=True)

    return book


# ── Main Scraper ──────────────────────────────────────────────────────────────

def scrape_book(url: str) -> Optional[ScrapedBook]:
    """
    Main entry point. Scrapes a single book URL.
    Returns ScrapedBook or None on failure.
    """
    driver = None
    try:
        driver = _build_driver()
        logger.info("Navigating to: %s", url)
        driver.get(url)

        # Wait for body to load
        WebDriverWait(driver, 15).until(
            EC.presence_of_element_located((By.TAG_NAME, "body"))
        )
        time.sleep(2)  # let JS render

        soup = BeautifulSoup(driver.page_source, "html.parser")
        domain = urlparse(url).netloc.lower()

        # Route to appropriate extractor
        if "books.toscrape.com" in domain:
            book = _scrape_books_toscrape(soup, url)
        elif "openlibrary.org" in domain:
            book = _scrape_openlibrary(soup, url)
        else:
            book = _scrape_generic(soup, url, driver)

        # Validate we got at least a title
        if not book.title:
            logger.warning("Could not extract title from %s", url)
            return None

        logger.info("Scraped: '%s' by '%s'", book.title, book.author)
        return book

    except TimeoutException:
        logger.error("Page load timeout for %s", url)
        return None
    except WebDriverException as exc:
        logger.error("WebDriver error for %s: %s", url, exc)
        return None
    except Exception as exc:
        logger.error("Unexpected error scraping %s: %s", url, exc)
        return None
    finally:
        if driver:
            driver.quit()


def bulk_scrape_books(urls: list[str]) -> tuple[list[ScrapedBook], list[str]]:
    """
    Scrape multiple URLs sequentially.
    Returns (successful_books, failed_urls).
    """
    successful = []
    failed = []

    for url in urls:
        result = scrape_book(url)
        if result:
            successful.append(result)
        else:
            failed.append(url)

        # Polite delay between requests
        time.sleep(1.5)

    return successful, failed
