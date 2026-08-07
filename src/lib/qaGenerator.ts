import type { FormField } from '../content/scraper';

export class QAGenerator {
  /**
   * Generates deterministic boundary and edge-case values for form fields,
   * bypassing external LLM safety filters (XSS/SQLi) and guaranteeing exact boundary math.
   */
  static generateQAData(fields: FormField[]): Record<string, string | boolean> {
    const result: Record<string, string | boolean> = {};

    const xssPayloads = [
      "<script>alert('XSS')</script>",
      "<img src=x onerror=alert(1)>",
      "javascript:alert(1)",
      "<svg/onload=alert('XSS')>",
      "'\"><script>alert(document.cookie)</script>"
    ];

    const sqliPayloads = [
      "' OR '1'='1",
      "1; DROP TABLE users; --",
      "admin'--",
      "' UNION SELECT NULL, NULL, NULL--",
      "1' OR 1=1--"
    ];

    const unicodePayloads = [
      "﷽",
      "🔥🚀🤖",
      "\u0000null",
      "𝓯𝓪𝓷𝓬𝔂 𝓽𝓮𝓯𝓽",
      "‏RTL_TEXT_תקן"
    ];

    fields.forEach((field, index) => {
      const fieldType = (field.type || 'text').toLowerCase();
      const labelLower = (field.label || field.placeholder || field.name || '').toLowerCase();

      // 1. Boolean / Selection fields
      if (fieldType === 'checkbox' || fieldType === 'radio') {
        result[field.id] = index % 2 === 0;
        return;
      }

      if (fieldType === 'select' && field.options && field.options.length > 0) {
        // Pick boundary option (last option in select list)
        result[field.id] = field.options[field.options.length - 1];
        return;
      }

      // 2. Numeric / Inputmode Numeric fields
      if (
        fieldType === 'number' ||
        fieldType === 'range' ||
        labelLower.includes('age') ||
        labelLower.includes('quantity') ||
        labelLower.includes('amount') ||
        labelLower.includes('count')
      ) {
        let val = -1; // Default underflow negative
        if (field.max !== undefined && field.max !== '') {
          const maxNum = parseFloat(field.max);
          val = isNaN(maxNum) ? 99999999 : maxNum + 1; // Boundary Overflow
        } else if (field.min !== undefined && field.min !== '') {
          const minNum = parseFloat(field.min);
          val = isNaN(minNum) ? -1 : minNum - 1; // Boundary Underflow
        } else {
          const numEdgeCases = [-99999, 0, 3.14159, 9007199254740991, -1];
          val = numEdgeCases[index % numEdgeCases.length];
        }
        result[field.id] = String(val);
        return;
      }

      // 3. Email fields
      if (fieldType === 'email' || labelLower.includes('email')) {
        const invalidEmails = [
          "invalid-email-address",
          "user@",
          "@domain.com",
          `user.${'a'.repeat(64)}@domain.com`,
          "<script>alert(1)</script>@test.com"
        ];
        result[field.id] = invalidEmails[index % invalidEmails.length];
        return;
      }

      // 4. Phone fields
      if (fieldType === 'tel' || labelLower.includes('phone') || labelLower.includes('mobile')) {
        const invalidPhones = [
          "+1000000000000000000000",
          "123",
          "abc-def-ghij",
          "(000) 000-0000",
          "+9999999999999999999"
        ];
        result[field.id] = invalidPhones[index % invalidPhones.length];
        return;
      }

      // 5. URL fields
      if (fieldType === 'url' || labelLower.includes('website') || labelLower.includes('url')) {
        const invalidUrls = [
          "ht`tp://invalid-domain",
          "javascript:alert(1)",
          "ftp://not-a-web-url",
          `https://${'a'.repeat(150)}.com`
        ];
        result[field.id] = invalidUrls[index % invalidUrls.length];
        return;
      }

      // 6. MaxLength Boundary Math (Exact Boundary Length Padding/Truncation)
      if (field.maxLength && field.maxLength > 0) {
        const max = field.maxLength;
        if (max <= 10) {
          result[field.id] = "A".repeat(max);
        } else {
          // Embed XSS/SQLi payload padded to exact max length
          const payload = xssPayloads[index % xssPayloads.length];
          if (payload.length >= max) {
            result[field.id] = payload.slice(0, max);
          } else {
            result[field.id] = payload + "A".repeat(max - payload.length);
          }
        }
        return;
      }

      // 7. General Text & Textarea fields (XSS, SQLi, Unicode, Long String Overflows)
      const edgeCaseType = index % 4;
      switch (edgeCaseType) {
        case 0:
          result[field.id] = xssPayloads[index % xssPayloads.length];
          break;
        case 1:
          result[field.id] = sqliPayloads[index % sqliPayloads.length];
          break;
        case 2:
          result[field.id] = unicodePayloads[index % unicodePayloads.length];
          break;
        case 3:
          result[field.id] = "OVERFLOW_" + "X".repeat(500);
          break;
      }
    });

    return result;
  }
}
