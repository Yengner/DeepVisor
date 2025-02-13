# **DeepVisor** 🚀  
### **Multi-Platform Ad Management & Insights SaaS**  

DeepVisor is an enterprise-level SaaS platform designed to **streamline marketing campaign management** across multiple social media platforms, including **Meta (Facebook & Instagram), TikTok, Google Ads, Reddit, YouTube, and more**.  

This project allows **business owners and marketers** to **integrate, track, analyze, and manage ad campaigns** in one centralized dashboard, offering insights, automation, and AI-driven suggestions for campaign optimization.

---

## **🌟 Features & Functionality**  

### **1. Multi-Platform Integration**  
- ✅ Connects with **Meta (Facebook & Instagram), TikTok, Google Ads, Reddit, YouTube, Twitter (X), and more**.  
- ✅ Pulls real-time **campaign, ad set, and ad-level data** from integrated accounts.  
- ✅ Allows businesses to manage ads, set budgets, and optimize performance across platforms.

### **2. Centralized Dashboard & Insights**  
- 📊 **View key marketing metrics** such as impressions, clicks, conversions, CTR, CPC, and ROI.  
- 📈 **Real-time analytics** for ad performance with interactive charts and visual reports.  
- 🎯 **AI-driven recommendations** to optimize campaigns and boost conversions.

### **3. Campaign Management & Automation**  
- ⚡ **Quickly create, edit, and launch ad campaigns** with a guided setup.  
- 🔄 **Automated ad optimizations** based on AI-driven insights.  
- 📌 **Multi-ad account support**, allowing businesses to manage multiple brands in one place.  

### **4. Secure Authentication & User Management**  
- 🛠 **Role-based access control** for managing teams and permissions.  
- ✅ Allows users to **add, remove, and manage ad accounts dynamically**.

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
