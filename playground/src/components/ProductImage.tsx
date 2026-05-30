interface ProductImageProps {
  src: string;
}
export const ProductImage = ({ src }: ProductImageProps) => {
  return (
    <img className="w-full h-[180px] object-cover" src={src} alt="product" />
  );
};
