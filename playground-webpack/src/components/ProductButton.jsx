import React from "react";

export const ProductButton = ({ label, onClick }) => {
  return (
    <button
      className="w-full py-2 rounded-lg bg-black text-white hover:bg-zinc-800 transition"
      onClick={onClick}
    >
      {label}
    </button>
  );
};
