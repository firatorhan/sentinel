import React from "react";

export const ProductButton = ({ label, onClick, disabled }) => {
  return (
    <button
      className="w-full py-2 rounded-lg bg-black text-white hover:bg-zinc-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
      onClick={onClick}
      disabled={disabled}
    >
      {label}
    </button>
  );
};
