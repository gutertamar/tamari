# Telegram Group Analyzer

סקריפט פשוט לניתוח קבוצות/ערוצים בטלגרם בעזרת Telethon.

## התקנה

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## הגדרת משתני סביבה

```bash
export TELEGRAM_API_ID="YOUR_API_ID"
export TELEGRAM_API_HASH="YOUR_API_HASH"
export TELEGRAM_SESSION="telegram-analytics"
```

## הרצה

```bash
python main.py --group "@groupname" --limit 1000 --top-words 20
```

לניתוח ממוקד על איראן בלבד אפשר להשתמש במילות המפתח המובנות (ברירת מחדל) או להגדיר משלך,
ולבחור סינון הודעות שכוללות לינק כדי להגדיל את הסיכוי לניתוחים אמינים:

```bash
python main.py --group "https://t.me/SeniaWaldberg" --limit 1000 --require-link
```

או עם מילות מפתח מותאמות:

```bash
python main.py --group "@groupname" --keywords "iran,tehran,איראן" --require-link
```

הסקריפט יציג:
- סך ההודעות
- המשתמשים הפעילים ביותר
- כמות הודעות לפי יום
- מילים נפוצות

> שים לב: בפעם הראשונה תתבצע התחברות לטלגרם ותתבקש להזין קוד אימות.
