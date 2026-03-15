# World Monitor IL — לוח בקרה ישראל–איראן

דשבורד חד-עמודי בעברית (RTL) בסגנון מודיעין "World Monitor" עם תצוגת מצב חיה.

## מה חדש

- חדשות בזמן אמת מ-RSS חינמי (Google News IL, Ynet, BBC World, Guardian World, Reuters World, France24 Arabic)
- התראות רקטות פיקוד העורף (OREF) על מפת ישראל
- מפת עולם תלת־ממדית (3D Globe) עם פינים לפי מיקום שנמצא בכותרות
- פס כותרות מתגלגל + כרטיסי KPI מהירים
- טבלת **דירוג אמינות מקורות בניבוי**
  - כל כותרת עם שפת ניבוי נרשמת כ"ניבוי פתוח"
  - לחלון זמן של 6 שעות
  - אם הופיעה התראת OREF בזמן החלון = הצלחה, אחרת = כישלון
  - ציון מבוסס דיוק + כמות החלטות שנפתרו (פחות מוטה מרעש קצר-טווח)
- רענון אוטומטי כל 30 שניות

## הוספת ערוצי טלגרם דרך RSS

אם יש לך ערוץ טלגרם ואת מביאה ממנו נתונים (JSON), אפשר לייצר RSS מקומי ולהוסיף אותו למעקב.

דוגמה:

```bash
python3 tools/generate_rss.py \
  --input telegram_posts.json \
  --output telegram_feed.xml \
  --title "Hadashot360" \
  --link "https://t.me/hadashot360" \
  --description "Generated from Telegram posts"
```

אחרי יצירת `telegram_feed.xml`, אפשר להגיש אותו משרת סטטי ולהוסיף אותו לרשימת `RSS_SOURCES` ב-`app.js`.

## הרצה מקומית

```bash
python3 -m http.server 4173
```

ואז לפתוח:

- `http://localhost:4173`

> אין צורך במפתח API.

נוצר על ידי תמר גוטר.
