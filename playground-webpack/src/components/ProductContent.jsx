import { ProductButton } from "./ProductButton";
import React from "react";


export const ProductContent = ({
  title,
  desc,
  price,
  serverHtml,
  rating,
  merchant,
  isInStock,
  badges,
}) => {
  return (
    <div className="p-4">
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-xs text-muted-foreground mb-3 leading-5">{desc}</p>
      <div className="text-base font-bold text-emerald-500 mb-1">{price}</div>

      {(rating != null || merchant || isInStock === false) && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
          {rating != null && <span>⭐ {rating.toFixed(1)}</span>}
          {merchant && <span>{merchant}</span>}
          {isInStock === false && (
            <span className="text-red-500 font-medium">Stokta yok</span>
          )}
        </div>
      )}

      {badges?.length > 0 && (
        <div className="flex gap-1 mb-3">
          {badges.map((b) => (
            <img key={b.id} src={b.imageUrl} alt={b.name} className="h-5" />
          ))}
        </div>
      )}

      <ProductButton
        label="Sepete Ekle"
        disabled={isInStock === false}
        onClick={() => alert(`${title} sepete eklendi!`)}
      />
    </div>
  );
};
