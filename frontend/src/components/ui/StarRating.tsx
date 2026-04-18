import { Star } from "lucide-react";

interface StarRatingProps {
  rating: number | null;
  size?: "sm" | "md";
}

export default function StarRating({ rating, size = "md" }: StarRatingProps) {
  if (rating === null) {
    return <span className="text-stone-400 text-sm">No rating</span>;
  }

  const fullStars = Math.floor(rating);
  const hasHalf = rating % 1 >= 0.5;
  const iconSize = size === "sm" ? "w-3 h-3" : "w-4 h-4";

  return (
    <div className="flex items-center gap-1">
      <div className="flex items-center">
        {[...Array(5)].map((_, i) => (
          <Star
            key={i}
            className={`${iconSize} ${
              i < fullStars
                ? "text-amber-400 fill-amber-400"
                : i === fullStars && hasHalf
                ? "text-amber-400 fill-amber-200"
                : "text-stone-300"
            }`}
          />
        ))}
      </div>
      <span className={`${size === "sm" ? "text-xs" : "text-sm"} text-stone-500 font-mono`}>
        {rating.toFixed(2)}
      </span>
    </div>
  );
}
