import { ProductImage } from "./ProductImage";
import { ProductContent } from "./ProductContent";
import React from "react";



export const ProductCard = ({ p }) => {
  return (
    <div className="rounded-2xl overflow-hidden bg-white shadow-lg w-64">
      <ProductImage src={p.image} />
      <ProductContent title={p.title} desc={p.desc} price={p.price} />
    </div>
  );
};