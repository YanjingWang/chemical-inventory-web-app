# 🧪 Chemical Inventory Web App

A full-stack web application for managing chemical receiving and inventory workflows in a laboratory environment.

This system simulates a real-world **chemical intake process**, from purchase order selection to barcode labeling and storage assignment.

---

## 🚀 Demo

🎥 Watch the demo video here:
👉 [Demo Video](PASTE_YOUR_VIDEO_LINK_HERE)

---

## 📌 Overview

This application digitizes the chemical receiving process:

1. Select a **Purchase Order (PO)**
2. Choose the correct **line item**
3. Enter **batch number**
4. Generate & print **barcode**
5. Scan barcode to confirm labeling
6. Get **recommended storage location**
7. Confirm placement → workflow completed

All data is persisted in a real database (not mock data).

---

## 🏗️ Tech Stack

### Frontend

- **React**
- **TypeScript**
- **Vite**
- **Tailwind CSS**
- **TanStack Query (React Query)**
- **React Hook Form + Zod**
- **JsBarcode**

### Backend

- **Node.js**
- **Express**
- **TypeScript**
- **Prisma ORM**
- **SQLite**

---

## 📂 Project Structure

```bash
chemical-inventory-web-app/
├── client/                 # React frontend
├── server/                 # Express backend
├── screenshots/            # App screenshots (optional)
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
└── README.md
```
