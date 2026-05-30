import { ProductButton } from "./ProductButton";

interface ProductContentProps {
  title: string;
  desc: string;
  price: string;
}

// @sentinel-auto(md="../assets/ProductContent.md")
export const ProductContent = ({ title, desc, price }: ProductContentProps) => {
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
