# Privacy Policy for Filli AI

**Last Updated:** August 18, 2026

**Filli AI** ("Filli AI", "we", "us", or "our") respects your privacy. This Privacy Policy explains how our Chrome Extension (**"Filli AI - AI Form Filler & QA Test Data"**) collects, uses, and protects information when you use our browser extension.

---

## 1. Information We Collect and Process

Filli AI is designed to help developers and QA testers generate synthetic mock data and auto-fill web form fields using AI. We prioritize data minimization and user privacy.

### A. Form Field Metadata (Temporary Processing)
* **What we inspect:** When you trigger Filli AI on an active web page, the extension reads structural HTML metadata (such as `<label>`, `name`, `id`, `type`, `placeholder`, and surrounding DOM attributes) of form elements on the current tab.
* **Purpose:** This metadata is processed solely to determine form field intent and generate contextually appropriate test data.
* **Retention:** Form metadata is processed ephemerally and is **never stored, sold, or logged** to external servers.

### B. Local Extension Storage (`chrome.storage.local`)
* **What is stored:** Custom testing personas, user preferences, prompt templates, and optional user-provided API keys (OpenAI, Anthropic, Gemini).
* **Location:** All such configuration data is encrypted and stored locally on your device within Chrome's isolated extension storage. It never leaves your browser unless interacting directly with your configured AI provider endpoints.

### C. Analytics (Optional Operational Data)
* We may collect anonymous aggregate usage statistics (such as feature click counts or error logs) via privacy-compliant analytics (PostHog/Supabase) to improve extension reliability. No form field content or sensitive inputs are ever included in telemetry.

---

## 2. Third-Party AI Services & Data Transmission

Filli AI connects to underlying AI model providers (such as OpenAI, Anthropic, or Google Gemini) directly via user-provided API keys or via encrypted proxy endpoints solely to fulfill test data generation requests.

* **No Model Training:** Structural form prompts sent to AI providers are processed strictly under zero-data-retention APIs and are **never used to train public AI models**.
* **Zero Data Monetization:** We do not sell, rent, or trade your data to third parties, advertisers, or data brokers.

---

## 3. Host Permissions Rationale

Filli AI requests permissions necessary for core extension functionality:
* `activeTab` & `scripting`: To read form input fields on the active browser tab and populate synthetic test data when you click "Autofill".
* `storage`: To save your custom personas and API settings locally on your machine.
* `contextMenus`: To allow right-click context menu options for quick test data generation.

---

## 4. Your Choices & Data Control

You have full control over your data:
* **API Keys & Settings:** You can update or delete your saved API keys and custom personas at any time via the extension options page.
* **Uninstalling:** Uninstalling the extension completely removes all locally stored extension data from your browser.

---

## 5. Contact Us

If you have any questions or concerns regarding this Privacy Policy, please contact us at:
* **Support Email:** support@filliai.com (or GitHub repository issues)
* **GitHub Repository:** [https://github.com/VinayK8866/Autofill-AI](https://github.com/VinayK8866/Autofill-AI)
