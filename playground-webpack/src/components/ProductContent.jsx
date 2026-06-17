import { ProductButton } from "./ProductButton";
import React from "react";


export const ProductContent = ({ title, desc, price, serverHtml }) => {
  return (
    <div className="p-4">
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-xs text-muted-foreground mb-3 leading-5">{desc}</p>
      <div className="text-base font-bold text-emerald-500 mb-3">{price}</div>

  

      <ProductButton
        label="Sepete Ekle"
        onClick={() => alert(`${title} sepete eklendi!`)}
      />
    </div>
  );
};
