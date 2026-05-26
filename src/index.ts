
import "./styles/main.css";
// Bu satır development ortamında gerekli sadece, çünkü Tailwind'in JIT modunda çalışması için CSS dosyasının import edilmesi gerekiyor. Ancak production build'inde bu satır gereksiz olabilir, çünkü Tailwind'in JIT modu sadece development ortamında çalışır ve production build'inde tüm gerekli CSS sınıfları zaten oluşturulmuş olur. Bu nedenle, production build'inde bu satırın kaldırılması performans açısından faydalı olabilir.
import "../dist/sentinel.css";
export * from "./react";