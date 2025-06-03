# **DeepVisor** 🚀
### **All-in-One Advertising Platform & Agency Companion**

DeepVisor is a SaaS solution that helps **individuals and businesses** manage advertising across multiple networks, including **Meta (Facebook & Instagram), TikTok, Google Ads, Reddit, YouTube, and more**. The platform is built to work alongside our advertising agency, giving clients transparent access to campaign results while also generating leads for the agency itself.

Users can **integrate, track, analyze, and optimize ad campaigns** from one dashboard. DeepVisor offers automation tools, AI-driven suggestions, and unique marketing utilities like scannable barcodes that link to a business hub and the option to add a digital business card to **Apple Wallet**.

With the recent addition of the `/public/proposal/[token]` page, clients will receive proposal links via email. Visiting this link opens a public proposal page where they can approve the proposal or request revisions (functionality in progress).

This README outlines the current workflow, database structure, and features planned for future development.

---

## **🌟 Features & Functionality**  

### **1. Multi-Platform Integration**
- ✅ Connect with **Meta (Facebook & Instagram), TikTok, Google Ads, Reddit, YouTube, Twitter (X), and more**.
- ✅ Pull real-time **campaign, ad set, and ad-level data** from integrated accounts.
- ✅ Manage ads, set budgets, and optimize performance across platforms.

### **2. Centralized Dashboard & Insights**
- 📊 **Key marketing metrics** like impressions, clicks, conversions, CTR, CPC, and ROI.
- 📈 **Real-time analytics** with interactive charts and visual reports.
- 🎯 **AI-driven recommendations** to improve campaign results.

### **3. Campaign Management & Collaboration**
- ⚡ **Create, edit, and launch campaigns** with a guided setup.
- 🔄 **Automated optimizations** based on AI-driven insights.
- 🤝 **Multi-account support** to manage several brands in one place.
- 📱 **Scannable barcodes** that link to your business hub and digital Apple Wallet card.

### **4. Proposal Workflow**
- 📧 Send proposal links via email using the new `/public/proposal/[token]` page.
- ✅ Clients can approve a proposal or request revisions *(coming soon)*.

### **5. Secure Authentication & User Management**
- 🔐 **Supabase Auth** for secure user authentication.
- 🛠 **Role-based access control** for managing teams and permissions.
- ✅ Add, remove, and manage ad accounts dynamically.

---

## **📂 Tech Stack**  

| **Technology**  | **Usage** |
|---------------|----------|
| **Next.js 15 (App Router)**  | Frontend framework |
| **TypeScript** | Type safety & scalability |
| **Tailwind CSS** | UI styling |
| **Node.js + Express.js** | Backend API |
| **Supabase** | Database & authentication |
| **PostgreSQL (RDS)** | Database for structured data |
| **Meta & TikTok API** | Ad data fetching |
| **ApexCharts** | Data visualization |

---

## **🗄️ Database Structure**  

DeepVisor uses **PostgreSQL** to store essential data for **ad campaigns, user integrations, and analytics**.

### **Main Tables**:
- **`users`** → Stores user details (ID, name, email, role).  
- **`integrations`** → Tracks user integrations (Meta, TikTok, etc.).  
- **`ad_accounts`** → Contains linked ad accounts per user.  
- **`campaigns`** → Stores campaign details with budget, targeting, and performance stats.  
- **`ads`** → Tracks individual ads within campaigns.

Example **ERD (Entity Relationship Diagram)**:

```plaintext
users (id) ---< integrations (id) ---< ad_accounts (id) ---< campaigns (id) ---< ads (id)
```

---

## **🚀 Getting Started**

1. **Install dependencies**
   ```bash
   npm install
   ```
2. **Add environment variables** required for Next.js and Supabase (see `.env.example`).
3. **Run the development server**
   ```bash
   npm run dev
   ```

Visit `http://localhost:3000` to view the app.

## **📝 Latest Update**

The proposal page now properly handles route parameters. See commit `78d1b49` titled *"Trying to fix PageProps Issue in proposal page"* for details.

## **🤝 Contributing**

Contributions and feature requests are welcome! Open an issue or submit a pull request.

