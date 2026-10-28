# RE Photo Pro

**Real Estate Photography Quote, Invoice & Job Management App**

A complete, mobile-friendly Progressive Web App (PWA) that runs entirely in your browser. No server, no paid account, and no recurring costs for core features.

---

## What it does

- Create professional quotes and invoices with itemized services
- Configurable pricing engine (square-footage tiers, add-ons, complexity)
- Property details form (manual entry + optional future API hook)
- Time tracking (photography, editing, driving, admin, etc.)
- Expense tracking and job profitability (revenue/hour vs profit/hour)
- Job history, search, filters, status workflow
- Client list (auto-built from jobs)
- Dashboard with revenue, outstanding balances, averages
- PDF export: Quote, Invoice, Receipt
- CSV export of all jobs
- Full JSON backup & restore
- Installable on iPhone (Add to Home Screen) and desktop

---

## How to open the app

### On Mac / Desktop
1. Download or copy the entire `re-photo-app` folder to your computer.
2. Open `index.html` in Chrome, Safari, Firefox, or Edge  
   (double-click or File → Open).
3. For best PWA experience, serve it locally:
   ```bash
   cd re-photo-app
   python3 -m http.server 8080
   ```
   Then visit `http://localhost:8080`.

### On iPhone (Safari)
1. Copy the folder to iCloud Drive, Dropbox, or email the files to yourself, **or** host the folder on any static host (GitHub Pages, Netlify, Cloudflare Pages, etc.).
2. Open the `index.html` URL (or the hosted URL) in **Safari**.
3. Tap the **Share** button → **Add to Home Screen**.
4. Name it “RE Photo Pro” and add. It will open full-screen like a native app.

> **Important:** Because data lives in the browser’s localStorage, the same data will **not** automatically appear on both your iPhone and Mac. Use the Backup / Restore feature to move data between devices.

---

## First-time setup (recommended)

1. Open **Settings & Backup**.
2. Fill in your **Business Information** (name, email, phone, tax rate, default terms).
3. Review **Pricing Rules** and adjust square-footage tiers and add-on prices to match your rates.
4. (Optional) Add a free-tier property-data API key if you want automatic lookups later. The app works fully without any key.

---

## Typical workflow

1. Tap **+ New Job**.
2. Enter client and property address.
3. Fill property details (sqft, beds, baths, etc.) – or use Lookup if you configured an API.
4. Apply a package or add line items (Interior, Exterior, Drone, etc.).
5. Tap **Recommend Price** for a suggested total based on your rules; override any price.
6. Save the job.
7. Track time and expenses as you work.
8. Generate **Quote PDF**, then later **Invoice PDF** or **Receipt PDF**.
9. Mark status as Paid when finished.

---

## Data storage & privacy

- Everything is stored in the **browser’s localStorage** on the device you are using.
- Nothing is sent to any server by the app itself (except the optional jsPDF CDN scripts and any property API you later configure).
- You can export a full JSON backup at any time and restore it on another device or after clearing browser data.
- Clearing site data / “Clear History” in the browser will erase the app’s records unless you have a backup.

---

## Backing up & restoring

**Backup**
- Settings → **Download Backup (JSON)**  
  Keep this file somewhere safe (iCloud, email, etc.).

**Restore**
- Settings → choose the JSON file under **Restore from Backup**.  
  This replaces all current data with the backup.

**CSV**
- Settings → **Export Jobs CSV** for spreadsheets or accounting.

---

## PDF, print, and exports

- From any saved job: **Quote PDF**, **Invoice PDF**, **Receipt PDF**.
- Files download to your device. On iPhone you can then share via Messages, Mail, or Files.
- You can also open the PDF and use the system Print dialog.

---

## Property address lookup

- By default the app is **manual-entry only**. It never invents square footage, beds, baths, or other facts.
- The Lookup button currently shows instructions.  
  If you obtain a free API key from a provider such as PropRaven, PropertyLayer, or similar (many offer free monthly tiers), store the key in Settings.  
  You (or a developer) can then wire the `lookupProperty` call in `app.js` to that provider.  
  The rest of the app already treats property data as editable and source-aware.

**Do not** scrape listing sites in violation of their terms.

---

## External services & costs

| Item                        | Required? | Cost                          | Notes                                      |
|-----------------------------|-----------|-------------------------------|--------------------------------------------|
| Core app (quotes, jobs, PDF)| No        | Free                          | Runs locally                               |
| jsPDF library               | Yes (CDN) | Free                          | Loaded from cdnjs                          |
| Property data API           | Optional  | Usually free tier available   | You must obtain and pay any overage yourself |
| Hosting (GitHub Pages, etc.)| Optional  | Free                          | Only if you want a public URL              |
| Paid accounts / subscriptions| No       | —                             | Not required for any core feature          |

---

## File list

```
re-photo-app/
├── index.html      # Main app shell
├── styles.css      # Mobile-first styles
├── app.js          # All application logic
├── manifest.json   # PWA manifest
├── sw.js           # Service worker (offline cache)
├── icon-192.png
├── icon-512.png
└── README.md       # This file
```

---

## Tips for iPhone use at a property

- Large buttons and readable totals are designed for one-handed use.
- Add the app to the Home Screen so it works offline after the first visit.
- Enter the address and rough details on-site, refine pricing later.
- Use time entries while still on location so hours stay accurate.

---

## Limitations (by design)

- No multi-device real-time sync (use backup/restore).
- No automatic paid property data without your own API key.
- PDF layout is clean and professional but not a full design studio.
- Tax calculation is a simple percentage you configure; it does not handle complex multi-jurisdiction tax rules.

---

Built as a practical tool for part-time real-estate photographers.  
All data stays on your devices. You stay in control of every price.
