import { ProductImage } from "./ProductImage";
import { ProductContent } from "./ProductContent";

interface ProductCardProps {
  p: {
    id: number;
    title: string;
    desc: string;
    price: string;
    image: string;
  };
}

export const ProductCard = ({ p }: ProductCardProps) => {
  return (
    <div className="rounded-2xl overflow-hidden bg-white shadow-lg w-64">
      <ProductImage src={p.image} />
      <ProductContent title={p.title} desc={p.desc} price={p.price} />
    </div>
  );
};