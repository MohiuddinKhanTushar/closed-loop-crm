# Closed Loop CRM 🚀
### High-Performance Sales Tracking for Solo Entrepreneurs

[![JavaScript](https://img.shields.io/badge/Logic-JavaScript%20ES6+-f7df1e?style=flat&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Node.js](https://img.shields.io/badge/Runtime-Node.js-339933?style=flat&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Firebase](https://img.shields.io/badge/Backend-Firebase%20%26%20Firestore-ffca28?style=flat&logo=firebase&logoColor=black)](https://firebase.google.com/)
[![CSS3](https://img.shields.io/badge/Styling-CSS3%20Advanced-1572B6?style=flat&logo=css3&logoColor=white)](https://www.w3.org/Style/CSS/)
[![Git](https://img.shields.io/badge/VCS-Git-F05032?style=flat&logo=git&logoColor=white)](https://git-scm.com/)

> **The Vision:** Commercial CRMs have evolved into "Management Surveillance" tools. **Closed Loop** is a mobile-first pivot—designed specifically for independent entrepreneurs on the road who need lead velocity and ROI data, not corporate bloat.

---

## 🏗 System Architecture & Node.js Environment

This project bridges **Meta Front-End standards** with **IBM Cloud Native principles**. While the core logic is Vanilla JS, the development and deployment lifecycle are powered by **Node.js**.

* **Frontend:** Vanilla JavaScript (ES6+), Advanced CSS3 (Flexbox/Grid), AOS (Animate on Scroll).
* **Environment (Node.js):** Used for managing the **Firebase CLI**, local development server environments, and handling dependencies via **NPM**.
* **Backend/Database:** Google Firebase & Firestore (NoSQL).
* **Authentication:** Firebase Auth with JWT-based persistent sessions.
* **DevOps:** Git Version Control, CI/CD Deployment via Node-based build scripts.



---

## 🎯 Key Features & Thinking

### 📱 Mobile-First "On-the-Road" UX
Solo entrepreneurs don't work from a cubicle. I architected this with a **Fluid UI** that prioritizes thumb-navigation and instant data entry, ensuring the tool follows the user, not the other way around.

### 🔄 The "Closed-Loop" Logic
Unlike static lead lists, I built an analytical engine that creates a feedback loop. When a lead status changes to "Closed-Won," the app triggers a real-time recalculation of the total **Pipeline ROI** and **Conversion Ratios** using Firestore Snapshot listeners.

### 🔐 Multi-User Data Isolation
Leveraging Firestore's NoSQL structure, I designed a hierarchical data model: `Users -> UID -> Leads`. This ensures enterprise-grade data privacy where each user's data is strictly isolated via **Firebase Security Rules**.

---

## 🛠 Engineering "War Stories" (Bugs & Solutions)

| Challenge | Solution | Developer Insight |
| :--- | :--- | :--- |
| **Git Tree Corruption** | Manually repaired HEAD and resolved merge deadlocks during deployment. | AI handles syntax; humans handle "broken state." Understanding Git internals saved the project. |
| **Node.js / Firebase CLI Versioning** | Resolved dependency conflicts between the local Node environment and Cloud Functions. | Consistent environment management is key to preventing "it works on my machine" syndrome. |
| **Async Race Conditions** | Refactored with `async/await` and implemented "Optimistic UI" updates. | On mobile data (4G/5G), perceived speed is UX. The UI must update before the cloud handshake finishes. |
| **Index Drift** | Transitioned from array-index mapping to **UUID** (Unique ID) tracking. | Data integrity in a cloud database requires non-sequential keys to prevent record overwriting. |

---

## 🚀 How to Run Locally

This project requires **Node.js** and the **Firebase CLI**.

1. Clone the repo: `git clone [https://github.com/MohiuddinKhanTushar/closed-loop-crm.git]`
2. Install Firebase Tools: `npm install -g firebase-tools`
3. Initialize Firebase: `firebase init`
4. Serve locally: `firebase serve` (powered by Node.js local server)

---

## 📖 Deep Dive
For a full narrative on my thinking process, market gap analysis, and sales-to-dev transition:
👉 **[Read the Full Case Study on Notion](https://quick-colby-d9d.notion.site/CASE-STUDY-Closed-Loop-CRM-2e7b34c9840080a1b51ae610c463b8d1?source=copy_link)**

---
*Developed as part of my journey toward Meta Front-End and IBM Full Stack Certification.*
