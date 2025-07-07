
# 🔔 Auto Pay Reminder System

Automated payment reminder tool using Google Sheets, Apps Script, and Telegram Bot API. Generates personalized, click-to-send WhatsApp links based on smart logic and reminder schedules — ideal for tracking pending payments or invoices.

---

## 🔧 Features

- ✅ Fully automated via time-based triggers
- 📅 Smart filtering based on skip flags, paid status, and custom frequency
- 📲 WhatsApp message links using `wa.me`
- 🤖 Telegram bot delivery for easy manual sending
- 📊 Google Sheets as your no-code backend

---

## 💼 Use Cases

- Freelancers reminding clients of pending invoices
- Community or club dues collection
- Tracking shared expenses or personal IOUs
- Subscription/membership payment reminders

---

## 🛠️ Tech Stack

| Component          | Purpose                              |
|-------------------|--------------------------------------|
| Google Sheets      | Acts as the structured database       |
| Google Apps Script | Automation engine (JavaScript)        |
| Telegram Bot API   | Delivers daily batch messages         |
| WhatsApp `wa.me`   | Pre-fills personalized messages       |

---

## 🚀 Getting Started

1. **Copy the Sheet Template**  
   Use the provided Excel template and upload it to Google Sheets.

2. **Set Up Apps Script**  
   Open `Extensions > Apps Script` in the sheet, paste the code from `scripts/Code.gs`, and save.

3. **Configure Telegram Bot**  
   - Create a Telegram bot using [BotFather](https://t.me/botfather)
   - Replace `TELEGRAM_BOT_TOKEN` and `YOUR_TELEGRAM_USER_CHAT_ID` in the script

4. **Customize the Message Template**  
   Edit the `CUSTOM_MESSAGE_TEMPLATE` in the script to suit your tone and language.

5. **Schedule the Trigger**  
   Use the custom menu to set up a daily or weekly trigger (`setupDailyTrigger()` etc).

---

## 📂 Folder Structure

```
auto-pay-reminder-system/
├── sheets_template/
│   └── MoneyTrackerTemplate.xlsx
├── scripts/
│   └── Code.gs
├── README.md
├── LICENSE
└── assets/
    └── screenshot.png
```

---

## 📄 License

MIT License – free to use and adapt for personal or commercial projects.

---

## 🙌 Contributions

Open to improvements — feel free to fork, suggest new delivery methods (email, SMS), or improve message generation logic.
