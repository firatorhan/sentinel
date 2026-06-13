import React from "react";

export const ProductImage = ({ src }) => {
  return (
    <img className="w-full h-[180px] object-cover" src={src} alt="product" />
  );
};
