import type { Plugin } from "vite";

export function sentinelPlugin(): Plugin {
  return {
    name: "sentinel-vite-plugin",
    transform(code: string, id: string) {
      if (!id.endsWith(".tsx") || id.includes("node_modules")) return null;
      if (!code.includes("@sentinel-auto")) return null;

      let transformedCode = code;

      // 1. Sentinel Import Entegrasyonu
      if (!transformedCode.includes('from "sentinel"')) {
        transformedCode = `import { Sentinel } from "sentinel";\n` + transformedCode;
      }

      // 2. React import kontrolü
      if (!transformedCode.includes('import React') && !transformedCode.includes('import * as React')) {
        transformedCode = `import React from "react";\n` + transformedCode;
      }

      /**
       * 3. Güvenli Regex Yapısı
       */
      const componentRegex = /\/\/\s*@sentinel-auto\s*(?:\(md=["'](.+?)["']\))?\s*\n\s*(export\s+)?const\s+(\w+)/g;
      
      let wrapperCodes = "";
      let mdImports = ""; 

      transformedCode = transformedCode.replace(
        componentRegex,
        (match, mdPath: string | undefined, isExport: string | undefined, componentName: string) => {
          
          // CRITICAL FIX: Her bileşen için md varlığını kesin olarak kontrol et ve sıfırla
          let hasMd = "undefined";
          
          if (mdPath && mdPath.trim() !== "") {
            mdImports += `import ${componentName}Md from "${mdPath}?raw";\n`;
            hasMd = `${componentName}Md`;
          }

          /**
           * 4. Kurşun Geçirmez Saf JS HOC Yapısı
           * Artık md adresi tanımlanmayan bileşenlerde `dialogMd: undefined` gidecektir.
           */
          wrapperCodes += `
            const _original_${componentName} = ${componentName};
            const _sentinel_wrapped_${componentName} = function(props) {
              return React.createElement(
                Sentinel,
                { dialogMd: ${hasMd}, componentProps: props },
                React.createElement(_original_${componentName}, props)
              );
            };
            export { _sentinel_wrapped_${componentName} as ${componentName} };
          `;

          return `const ${componentName}`;
        }
      );

      // 5. Biriktirilen dinamik markdown importlarını en tepeye güvenle enjekte et
      if (mdImports) {
        transformedCode = mdImports + transformedCode;
      }

      // 6. Oluşturulan HOC sarmalayıcılarını dosyanın en sonuna ekle
      if (wrapperCodes) {
        transformedCode += `\n\n/* --- Sentinel Safe Auto Wrappers --- */\n` + wrapperCodes;
      }

      return {
        code: transformedCode,
        map: null
      };
    },
  };
}