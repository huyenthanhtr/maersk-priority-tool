markdown# Maersk Vietnam — Priority Routing Tool
Internship Project | May 2026
Nguyen Ngo Thao Van · Luong Tran Quang Vinh · Tran Thanh Huyen

---

## Cấu trúc folder
maersk-priority-tool/
├── index.html              ← Landing page (DONE - Huyen)
├── README.md               ← File này
├── pages/
│   ├── scoring.html        ← Page 1 (Vinh làm)
│   ├── queue.html          ← Page 3 (DONE - Huyen)
│   └── dashboard.html      ← Page 2 (cả 3 làm)
├── js/
│   ├── scoringEngine.js    ← Core logic (DONE - KHÔNG SỬA)
│   ├── scoring.js          ← Logic riêng Page 1 (Vinh làm)
│   ├── queue.js            ← Logic riêng Page 3 (DONE - Huyen)
│   └── dashboard.js        ← Logic riêng Page 2 (cả 3 làm)
├── css/
│   ├── global.css          ← Style chung (DONE - KHÔNG SỬA)
│   ├── scoring.css         ← Style riêng Page 1 (Vinh làm)
│   ├── queue.css           ← Style riêng Page 3 (DONE - Huyen)
│   └── dashboard.css       ← Style riêng Page 2 (cả 3 làm)
└── data/
└── tickets.json        ← 50 ticket mẫu (DONE - KHÔNG SỬA)

---

## Quan trọng — Đọc trước khi code

### 1. Live Server — Bắt buộc dùng
Không mở file HTML trực tiếp bằng trình duyệt vì `fetch()` sẽ bị chặn, ticket không load được.

### 2. global.css — Không viết lại những gì đã có
`global.css` đã có sẵn các class sau, dùng thẳng vào HTML không cần khai báo lại trong file css riêng:

**Layout:**
- `.navbar` — thanh nav trên cùng
- `.page-container` — wrapper chính, max-width 1200px
- `.page-header`, `.page-title`, `.page-subtitle`
- `.card` — box trắng có border và shadow

**Lane badges:**
- `.badge.badge-critical` — badge đỏ
- `.badge.badge-priority` — badge vàng  
- `.badge.badge-standard` — badge xanh lá

**Row highlight theo lane:**
- `.row-critical` — nền đỏ nhạt
- `.row-priority` — nền vàng nhạt
- `.row-standard` — nền xanh nhạt

**Buttons:**
- `.btn.btn-primary` — nút xanh Maersk
- `.btn.btn-secondary` — nút trắng có border

**Form:**
- `.form-group`, `.form-label`, `.form-select`, `.form-input`

**Table:**
- `.table-wrapper`, `table`, `thead`, `th`, `td` — đã có style sẵn

**CSS Variables quan trọng:**
```css
--maersk-blue: #00243D      /* màu navbar */
--maersk-light-blue: #0073AB /* màu button primary */
--critical: #ef4444          /* đỏ */
--priority: #f59e0b          /* vàng */
--standard: #22c55e          /* xanh lá */
--text-primary: #111827
--text-secondary: #6b7280
--border: #e5e7eb
--bg-page: #f9fafb
--bg-white: #ffffff
--radius: 8px
```

### 3. scoringEngine.js — Cách dùng
File này export các function dùng chung. Load trước `scoring.js` hoặc `dashboard.js`:

```html
<script src="../js/scoringEngine.js"></script>
<script src="../js/scoring.js"></script>  
```

Các function có sẵn:
```javascript
// Tính Priority Score (trả về số 0-100)
calculateScore({ urgencyFlag, etdDays, requestType, customerTier })

// Xác định lane từ score
getLane(score) // → 'Critical' | 'Priority' | 'Standard'

// Lấy SLA target
getSLA(lane) // → '1 working hour' | '2 working hours' | '4 working hours'

// Lấy gợi ý hành động
getAction(lane)

// Lấy class badge tương ứng
getLaneBadgeClass(lane) // → 'badge-critical' | 'badge-priority' | 'badge-standard'
```

Ví dụ dùng trong scoring.js:
```javascript
const score = calculateScore({
  urgencyFlag: 'urgent',       // 'urgent' | 'semi_urgent' | 'normal'
  etdDays: 2,                  // số nguyên
  requestType: 'B/L Amendment',
  customerTier: 'Key Account'
})
const lane = getLane(score)    // 'Critical'
const sla  = getSLA(lane)      // '1 working hour'
```

### 4. tickets.json — Không sửa
File này có 50 ticket mẫu dùng chung cho Page 2 và Page 3. Cấu trúc mỗi ticket:
```json
{
  "id": "TK001",
  "requestType": "B/L Amendment",
  "urgencyFlag": "urgent",
  "etdDays": 1,
  "customerTier": "Key Account",
  "assignedPIC": "PIC_A",
  "createdTime": "08:00",
  "firstResponseTime": "08:45",
  "status": "Met"
}
```
Priority Score và Lane **không có sẵn trong JSON** — phải tính bằng `scoringEngine.js` khi load.

### 5. Không dùng icon hoặc emoji
Không dùng emoji trong UI (không có icon pack được cài). Thay bằng text label hoặc số thứ tự.


## Phân công còn lại
| Page | File | PIC | Deadline |
| Page 1 — Priority Scoring | `pages/scoring.html` + `css/scoring.css` + `js/scoring.js` | Vinh | 09/05 |
| Page 2 — Simulation Dashboard | `pages/dashboard.html` + `css/dashboard.css` + `js/dashboard.js` | Cả 3 | 11/05 |