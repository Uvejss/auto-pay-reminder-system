// --- CONFIGURATION ---
// IMPORTANT: Make sure these match your Google Sheet name and worksheet name exactly.
const SHEET_NAME = 'My Money Track'; // <<<< CONFIRM THIS MATCHES YOUR SPREADSHEET NAME
const SHEET_WORKSHEET_NAME = 'Sheet1'; // <<<< CONFIRM THIS MATCHES YOUR WORKSHEET TAB NAME (e.g., 'Sheet1')
const HEADER_ROW = 1; // Assuming headers are in row 1
const DATA_START_ROW = 2; // Data starts from row 2
const MAX_ROWS_TO_PROCESS = 50; // <<<< NEW: Hard limit on the number of data rows to process

// Column indices (0-based) - CRITICAL: These MUST MATCH your sheet's column order!
const COL_FRIEND_NAME = 0;
const COL_WHATSAPP_CONTACT = 1;
const COL_AMOUNT_LENT = 2;
const COL_AMOUNT_PAID_BACK = 3;
const COL_REMAINING_MONEY = 4; // This is the calculated column in your sheet
const COL_SKIP_REMINDER = 5;
const COL_INTENSITY = 6;
const COL_LAST_MSG_SENT = 7;
const COL_NEXT_REMINDER_DATE = 8;
const COL_PAID_DATE = 9;
const COL_MESSAGE_STATUS = 10; // Adjusted column index

// --- TELEGRAM BOT CONFIGURATION ---
const TELEGRAM_BOT_TOKEN = 'find your'; // <<<< IMPORTANT: REPLACE WITH YOUR BOT'S TOKEN from @BotFather
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`; // Corrected API URL
const YOUR_MAIN_WHATSAPP_NUMBER = 'if you want to'; // <<<< IMPORTANT: REPLACE WITH YOUR ACTUAL MAIN WHATSAPP NUMBER for message template
const YOUR_TELEGRAM_USER_CHAT_ID = 'find your own '; // <<<< IMPORTANT: REPLACE WITH YOUR OWN CHAT ID (from getUpdates)

// --- CUSTOM MESSAGE TEMPLATE ---
// Use {{friendName}} for the friend's name, {{amount}} for the OUTSTANDING amount,
// and {{dueDate}} for the dynamically calculated last day of the current month.
const CUSTOM_MESSAGE_TEMPLATE = "Dear Mr. {{friendName}}, This is a gentle reminder from Siddharth Bank that an outstanding balance of Rs. {{amount}} remains on your loan account, due by {{dueDate}}. We kindly request you to settle this amount promptly to maintain seamless service. Thank you for choosing Siddharth Bank for your financial journey.";


// --- CORE SCRIPT FUNCTIONS ---

/**
 * Creates a custom menu in the Google Sheet for easy access to the script.
 * Replaced Browser.msgBox with Logger.log for editor compatibility.
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Money Tracker')
      .addItem('Generate & Send Messages (Manual Run)', 'generateAndSendMessages')
      .addSeparator() // Separator for clarity
      .addSubMenu(ui.createMenu('Set Up Automation Triggers')
          .addItem('Set Up Daily Trigger', 'setupDailyTrigger')
          .addItem('Set Up Weekly Trigger', 'setupWeeklyTrigger')
          .addItem('Set Up Bi-Weekly Trigger (Every 15 Days)', 'setupBiWeeklyTrigger') // This will show a message explaining the 15-day logic
          .addItem('Set Up Monthly Trigger (1st of Month)', 'setupMonthlyTrigger')
          .addItem('Delete All Triggers', 'deleteAllTriggers'))
      .addToUi();
  Logger.log('Custom menu "Money Tracker" created.');
}

/**
 * Main function to generate and send messages based on sheet data.
 */
function generateAndSendMessages() {
  Logger.log('generateAndSendMessages started.'); // Log at the very beginning
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_WORKSHEET_NAME);
  if (!sheet) {
    Logger.log(`ERROR: Worksheet named "${SHEET_WORKSHEET_NAME}" not found in spreadsheet "${SHEET_NAME}". Please check the SHEET_WORKSHEET_NAME variable in the script.`);
    Browser.msgBox('Error', `Worksheet named "${SHEET_WORKSHEET_NAME}" not found. Please check the SHEET_WORKSHEET_NAME variable.`, Browser.Buttons.OK);
    return; // Early exit if sheet not found
  }
  Logger.log(`Sheet "${SHEET_WORKSHEET_NAME}" found.`); // FIX: Corrected typo here

  // --- EFFICIENCY IMPROVEMENT START ---
  // Get the last row with content and last column with content
  const actualLastRow = sheet.getLastRow();
  const actualLastColumn = sheet.getLastColumn();

  // Determine the effective last row to process, applying the hard limit
  const effectiveLastRow = Math.min(actualLastRow, DATA_START_ROW + MAX_ROWS_TO_PROCESS - 1);

  // If there's no data beyond the header row (or within our limit), exit early
  if (effectiveLastRow < DATA_START_ROW) {
    Logger.log('No data rows found within processing limit. Exiting script.');
    const ui = SpreadsheetApp.getUi();
    ui.alert('Money Tracker Automation Summary', 'No data rows found to process within the set limit. Script finished.', ui.ButtonSet.OK);
    return;
  }

  // Get values only from the actual data range (from DATA_START_ROW to effectiveLastRow)
  // The range starts at row DATA_START_ROW (e.g., 2) and column 1 (A)
  // The number of rows is (effectiveLastRow - DATA_START_ROW + 1)
  // The number of columns is actualLastColumn
  const dataRange = sheet.getRange(DATA_START_ROW, 1, effectiveLastRow - DATA_START_ROW + 1, actualLastColumn);
  const values = dataRange.getValues(); // Raw values
  const displayValues = dataRange.getDisplayValues(); // Displayed values (for formulas)
  Logger.log(`Processing data from sheet row ${DATA_START_ROW} to ${effectiveLastRow}. Total data rows to process: ${values.length}`);
  // --- EFFICIENCY IMPROVEMENT END ---

  const ui = SpreadsheetApp.getUi();
  let messagesSentCount = 0;
  let messagesSkippedCount = 0;
  let whatsappLinksToSend = []; // Array to collect WhatsApp links

  const today = new Date();
  const formattedToday = Utilities.formatDate(today, ss.getSpreadsheetTimeZone(), 'dd/MM/yyyy');

  for (let i = 0; i < values.length; i++) { // Loop from 0 to values.length - 1 because 'values' now only contains data rows
    const sheetRowIndex = i + DATA_START_ROW; // Calculate actual sheet row index (1-based)
    Logger.log(`Processing row index: ${i} (Sheet Row: ${sheetRowIndex})`); // Log current row being processed

    // FIX: Assign row and displayRow for current iteration
    const row = values[i];
    const displayRow = displayValues[i];

    const friendName = row[COL_FRIEND_NAME];
    const whatsappContact = row[COL_WHATSAPP_CONTACT];
    const outstandingAmount = parseFloat(displayRow[COL_REMAINING_MONEY].replace(',', '') || 0);

    const skipReminder = (row[COL_SKIP_REMINDER] || '').toString().trim().toUpperCase();
    const intensity = (row[COL_INTENSITY] || '').toString().trim();
    const lastMessageSentDate = row[COL_LAST_MSG_SENT] ? new Date(row[COL_LAST_MSG_SENT]) : null;
    const nextReminderDate = row[COL_NEXT_REMINDER_DATE] ? new Date(row[COL_NEXT_REMINDER_DATE]) : null;
    const paidDate = row[COL_PAID_DATE] ? new Date(row[COL_PAID_DATE]) : null;

    // Dynamically calculate the due date as the last day of the current month
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth(); // 0-indexed (Jan is 0)
    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0); // Day 0 of next month is last day of current month
    const formattedDueDate = Utilities.formatDate(lastDayOfMonth, ss.getSpreadsheetTimeZone(), 'MMMM dd,yyyy'); // e.g., "July 31, 2025"

    const record = {
      name: friendName,
      whatsappContact: whatsappContact,
      outstandingAmount: outstandingAmount,
      skipReminder: skipReminder,
      intensity: intensity,
      lastMessageSent: lastMessageSentDate,
      nextReminderDate: nextReminderDate,
      paidDate: paidDate,
      dueDate: formattedDueDate // Use the dynamically calculated due date
    };

    Logger.log(`Record for ${friendName}: ${JSON.stringify(record)}`); // Log the record data

    const shouldSend = shouldSendMessage(record, today);
    Logger.log(`shouldSend for ${friendName}: ${shouldSend}`); // Log the decision

    if (shouldSend) {
      Logger.log(`Attempting to send message for ${friendName}.`);
      const messageContent = generateMessageContent(record);
      let sendSuccess = false;
      let statusMessage = "";

      if (record.whatsappContact) {
        const whatsappLink = generateWhatsAppLink(record.whatsappContact, messageContent);
        whatsappLinksToSend.push({ name: record.name, link: whatsappLink });
        statusMessage = "WhatsApp link collected for batch send to Telegram.";
        sendSuccess = true; // Mark as success for this stage
      } else {
        statusMessage = "Skipped: WhatsApp Contact missing.";
      }

      if (sendSuccess) {
        messagesSentCount++;
        // Update 'Last Message Sent' and 'Next Reminder Date' in the sheet
        sheet.getRange(sheetRowIndex, COL_LAST_MSG_SENT + 1).setValue(formattedToday);
        updateNextReminderDate(sheet, sheetRowIndex, today, record.intensity, ss.getSpreadsheetTimeZone());
        Logger.log(`Sheet updated for ${friendName}.`);
      } else {
        messagesSkippedCount++;
        Logger.log(`Message not sent for ${friendName}: ${statusMessage}`);
      }
      sheet.getRange(sheetRowIndex, COL_MESSAGE_STATUS + 1).setValue(statusMessage);

    } else {
      messagesSkippedCount++;
      // Log status in the sheet for skipped messages
      let skipReason = '';
      if (record.skipReminder === "YES") {
          skipReason = `Skipped by 'Skip Reminder' flag.`;
      } else if (record.paidDate instanceof Date && !isNaN(record.paidDate.getTime())) {
          const formattedPaidDate = Utilities.formatDate(record.paidDate, ss.getSpreadsheetTimeZone(), 'dd/MM/yyyy');
          skipReason = `Skipped because 'Paid Date' is recorded (${formattedPaidDate}).`;
      } else if (record.outstandingAmount <= 0.01) {
          skipReason = `Skipped because 'Remaining Money' is zero or negligible.`;
      } else if (record.nextReminderDate && record.nextReminderDate.getTime() > today.getTime()) {
          const formattedNextReminderDate = Utilities.formatDate(record.nextReminderDate, ss.getSpreadsheetTimeZone(), 'dd/MM/yyyy');
          skipReason = `Skipped, next reminder is in future (${formattedNextReminderDate}).`;
      } else {
          skipReason = `Skipped for other reasons (check conditions).`;
      }
      Logger.log(`Skipping ${friendName}: ${skipReason}`); // Log the skip reason
      sheet.getRange(sheetRowIndex, COL_MESSAGE_STATUS + 1).setValue(`Message Skipped: ${skipReason}`);
    }
  }

  // --- Send batch WhatsApp links to user via Telegram ---
  if (whatsappLinksToSend.length > 0) {
    Logger.log(`Sending batch WhatsApp links to Telegram. Number of links: ${whatsappLinksToSend.length}`);
    sendBatchWhatsAppLinksToTelegram(whatsappLinksToSend);
  } else {
    Logger.log('No WhatsApp links collected to send in batch.');
  }


  Logger.log(`Total messages sent/collected: ${messagesSentCount}`);
  Logger.log(`Total records skipped: ${messagesSkippedCount}`);

  // Provide a summary message to the user
  let summary = `Automation complete!\n\n`;
  summary += `WhatsApp links collected: ${messagesSentCount}\n`;
  summary += `Records skipped: ${messagesSkippedCount}\n\n`;
  summary += `**Important:** A batch message with clickable WhatsApp links has been sent to your Telegram account. Click them to send!`;
  summary += `\nCheck 'Message Status' column for details and Apps Script 'Executions' for full logs.`;

  ui.alert('Money Tracker Automation Summary', summary, ui.ButtonSet.OK);
  Logger.log('generateAndSendMessages completed.'); // Log at the very end
}

/**
 * Determines if a message should be sent for a given record.
 * @param {Object} record - The record object from the sheet.
 * @param {Date} today - The current date.
 * @returns {boolean} True if a message should be sent, false otherwise.
 */
function shouldSendMessage(record, today) {
  Logger.log(`Checking shouldSendMessage for ${record.name}.`);

  // 1. Check 'Skip Reminder' flag
  if (record.skipReminder === "YES") {
    Logger.log(`shouldSendMessage: ${record.name} skipped by 'Skip Reminder' flag.`);
    return false;
  }

  // 2. Check if 'Paid Date' is filled (meaning debt is fully settled by user's confirmation)
  if (record.paidDate instanceof Date && !isNaN(record.paidDate.getTime())) {
    Logger.log(`shouldSendMessage: ${record.name} skipped because 'Paid Date' is recorded.`);
    return false; // Debt is paid, no message needed
  }

  // 3. Check if 'Outstanding Amount' is zero or negligible
  if (record.outstandingAmount <= 0.01) {
    Logger.log(`shouldSendMessage: ${record.name} skipped because 'Outstanding Amount' is zero or negligible (${record.outstandingAmount}).`);
    return false; // No amount owed, no message needed
  }

  // 4. Check if WhatsApp Contact is provided
  if (!record.whatsappContact || record.whatsappContact.toString().trim() === '') {
      Logger.log(`shouldSendMessage: ${record.name} skipped because WhatsApp Contact is missing.`);
      return false; // WhatsApp Contact missing
  }

  // Calculate the next due date based on last message sent and intensity
  let nextDueTimestamp;
  if (!record.lastMessageSent) {
      Logger.log(`shouldSendMessage: ${record.name} - No last message sent date. Due now.`);
      nextDueTimestamp = today.getTime(); // Effectively due now
  } else {
      const lastSentTime = record.lastMessageSent.getTime();
      const intensity = record.intensity;
      Logger.log(`shouldSendMessage: ${record.name} - Last sent: ${record.lastMessageSent}, Intensity: ${intensity}`);

      switch (intensity) {
          case '1': // Every 15 days
              nextDueTimestamp = lastSentTime + (15 * 24 * 60 * 60 * 1000);
              break;
          case '2': // Every week (7 days)
              nextDueTimestamp = lastSentTime + (7 * 24 * 60 * 60 * 1000);
              break;
          case '3': // Every day
              nextDueTimestamp = lastSentTime + (1 * 24 * 60 * 60 * 1000);
              break;
          default: // Blank/empty or any other value: Once a month
              const dayOfMonth = record.lastMessageSent.getDate();
              const nextMonthDate = new Date(record.lastMessageSent.getFullYear(), record.lastMessageSent.getMonth() + 1, dayOfMonth);
              nextDueTimestamp = nextMonthDate.getTime();
              Logger.log(`shouldSendMessage: ${record.name} - Default (monthly) calculation. Next month date: ${nextMonthDate}`);
              break;
      }
  }

  // Compare today's date with the calculated next due date
  if (today.getTime() >= nextDueTimestamp) {
      Logger.log(`shouldSendMessage: ${record.name} - Today (${today}) is on or after calculated due date (${new Date(nextDueTimestamp)}).`);
      // Also, respect the 'Next Reminder Date' if it was manually pushed out further than our calculated due date
      if (record.nextReminderDate && record.nextReminderDate.getTime() > today.getTime()) {
          Logger.log(`shouldSendMessage: ${record.name} skipped, manual Next Reminder Date (${record.nextReminderDate}) is in future.`);
          return false; // Manually set future reminder date overrides calculated one
      }
      Logger.log(`shouldSendMessage: ${record.name} - Returning TRUE (should send).`);
      return true;
  }

  Logger.log(`shouldSendMessage: ${record.name} - Today (${today}) is before calculated due date (${new Date(nextDueTimestamp)}). Returning FALSE.`);
  return false; // Not due yet
}

/**
 * Generates the message content using the CUSTOM_MESSAGE_TEMPLATE.
 * @param {Object} record - The record object.
 * @returns {string} The formatted message content.
 */
function generateMessageContent(record) {
  const amountFormatted = record.outstandingAmount.toFixed(2); // Use outstandingAmount for the message

  let message = CUSTOM_MESSAGE_TEMPLATE;
  message = message.replace(/\{\{friendName\}\}/g, record.name);
  message = message.replace(/\{\{amount\}\}/g, amountFormatted);
  message = message.replace(/\{\{dueDate\}\}/g, record.dueDate); // Replace due date placeholder

  return message;
}

/**
 * Generates a WhatsApp wa.me link.
 * @param {string} contactNumber - The WhatsApp contact number (e.g., +91XXXXXXXXXX).
 * @param {string} message - The message content.
 * @returns {string} The clickable wa.me link.
 */
function generateWhatsAppLink(contactNumber, message) {
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${contactNumber}?text=${encodedMessage}`;
}

/**
 * Helper function to escape special characters for MarkdownV2.
 * This function should be applied to any text that is NOT a URL or part of a Markdown URL structure.
 * It escapes characters that have special meaning in MarkdownV2.
 */
function escapeMarkdownV2Text(text) {
  // Characters that need to be escaped in MarkdownV2 text:
  // _, *, [, ], (, ), ~, `, >, #, +, -, =, |, {, }, ., !
  return text.replace(/([_*[\]()~`>#+\-=|{}.!])/g, '\\$1');
}

/**
 * Sends a batch of WhatsApp links to the user's Telegram.
 * @param {Array<Object>} linksArray - An array of {name: string, link: string} objects.
 */
function sendBatchWhatsAppLinksToTelegram(linksArray) {
  Logger.log('sendBatchWhatsAppLinksToTelegram started.');
  if (!YOUR_TELEGRAM_USER_CHAT_ID || YOUR_TELEGRAM_USER_CHAT_ID.toString().trim() === '') {
    Logger.log("ERROR: YOUR_TELEGRAM_USER_CHAT_ID is not set. Cannot send batch WhatsApp links to Telegram.");
    return;
  }

  let batchMessageParts = [];
  // Escape the header text and add a newline
  batchMessageParts.push(escapeMarkdownV2Text("🔔 WhatsApp Reminders Due:") + "\n\n");

  linksArray.forEach((item, index) => {
    // Escape the friend's name for display within the link text (no bolding here to simplify)
    const escapedFriendName = escapeMarkdownV2Text(item.name);

    // The WhatsApp link URL itself should NOT be escaped.
    const whatsappLinkUrl = item.link;

    // Construct the MarkdownV2 link: [Link Text](URL)
    // The linkText is already escaped, the URL is not.
    batchMessageParts.push(`${index + 1}\\. [Send to ${escapedFriendName}](${whatsappLinkUrl})\n\n`); // Removed bolding from link text
  });

  // Escape the final instruction text
  batchMessageParts.push(escapeMarkdownV2Text("Click each link to open WhatsApp and send the message."));

  const finalBatchMessage = batchMessageParts.join(''); // Join all parts into one string
  Logger.log(`Batch message prepared for Telegram:\n${finalBatchMessage}`);

  try {
    const payload = {
      chat_id: YOUR_TELEGRAM_USER_CHAT_ID,
      text: finalBatchMessage,
      parse_mode: 'MarkdownV2', // Keep MarkdownV2 for clickable links
      disable_web_page_preview: true // Optional: Prevents Telegram from showing a preview of the wa.me link
    };

    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    Logger.log(`Attempting to send Telegram message to chat ID: ${YOUR_TELEGRAM_USER_CHAT_ID}`);
    const response = UrlFetchApp.fetch(TELEGRAM_API_URL, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();
    const responseJson = JSON.parse(responseText);
    Logger.log(`Telegram API Response Code: ${responseCode}, Text: ${responseText}`);

    if (responseCode === 200 && responseJson.ok) {
      Logger.log("Batch WhatsApp links sent to user's Telegram successfully.");
    } else {
      Logger.log(`ERROR: Failed to send batch WhatsApp links to user's Telegram (Code: ${responseCode}). Response: ${responseText}`);
    }
  } catch (e) {
    Logger.log(`CRITICAL ERROR: Error sending batch WhatsApp links to user's Telegram: ${e.message}`);
  }
  Logger.log('sendBatchWhatsAppLinksToTelegram completed.');
}

/**
 * Calculates and updates the 'Next Reminder Date' in the sheet.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - The active sheet.
 * @param {number} rowIndex - The 1-based row index in the sheet.
 * @param {Date} lastSentDate - The date the message was just sent.
 * @param {string} intensity - The intensity level ('', '1', '2', '3').
 * @param {string} timeZone - The spreadsheet's timezone.
 */
function updateNextReminderDate(sheet, rowIndex, lastSentDate, intensity, timeZone) {
    let nextReminderDate;

    switch (intensity) {
        case '1': // Every 15 days
            nextReminderDate = new Date(lastSentDate.getTime() + (15 * 24 * 60 * 60 * 1000));
            break;
        case '2': // Every week (7 days)
            nextReminderDate = new Date(lastSentDate.getTime() + (7 * 24 * 60 * 60 * 1000));
            break;
        case '3': // Every day
            nextReminderDate = new Date(lastSentDate.getTime() + (1 * 24 * 60 * 60 * 1000));
            break;
        default: // Blank/empty or any other value: Once a month
            // Set to the same day of the month, but in the next month
            const dayOfMonth = lastSentDate.getDate();
            const nextMonthDate = new Date(lastSentDate.getFullYear(), lastSentDate.getMonth() + 1, dayOfMonth);
            nextReminderDate = nextMonthDate; // Assign the Date object directly
            break;
    }

    // Format the next reminder date in DD/MM/YYYY for writing to sheet
    const formattedNextReminder = Utilities.formatDate(nextReminderDate, timeZone, 'dd/MM/yyyy');
    sheet.getRange(rowIndex, COL_NEXT_REMINDER_DATE + 1).setValue(formattedNextReminder);
}


// --- AUTOMATION TRIGGERS ---

/**
 * Sets up a daily time-driven trigger to run the automation.
 * This function is accessible from the custom menu.
 */
function setupDailyTrigger() {
  ScriptApp.newTrigger('generateAndSendMessages')
      .timeBased()
      .everyDays(1) // Runs every day
      .atHour(9)     // At 9 AM (adjust as needed)
      .create();
  Logger.log('Daily trigger set to run "generateAndSendMessages" every day at 9 AM.');
  Browser.msgBox('Trigger Setup', 'A daily trigger has been set to run "generateAndSendMessages" every day at 9 AM.', Browser.Buttons.OK);
}

/**
 * Sets up a weekly time-driven trigger to run the automation.
 * This function is accessible from the custom menu.
 */
function setupWeeklyTrigger() {
  ScriptApp.newTrigger('generateAndSendMessages')
      .timeBased()
      .everyWeeks(1) // Runs every week
      .onWeekDay(ScriptApp.WeekDay.MONDAY) // Runs on Monday (adjust as needed)
      .atHour(9)     // At 9 AM (adjust as needed)
      .create();
  Logger.log('Weekly trigger set to run "generateAndSendMessages" every Monday at 9 AM.');
  Browser.msgBox('Trigger Setup', 'A weekly trigger has been set to run "generateAndSendMessages" every Monday at 9 AM.', Browser.Buttons.OK);
}

/**
 * Sets up a bi-weekly (every 15 days) time-driven trigger to run the automation.
 * Note: Apps Script doesn't have a direct "every 15 days" option. We'll use a daily trigger
 * and let the script's internal logic handle the 15-day check.
 * This function is accessible from the custom menu.
 */
function setupBiWeeklyTrigger() {
  // For bi-weekly, it's best to set a daily trigger and let the script's internal logic decide.
  // However, for distinct trigger management, we'll create a unique one.
  // The 'everyDays(15)' is not directly supported. We'll simulate by running daily
  // and relying on the 'shouldSendMessage' logic.
  // For simplicity and clarity in trigger management, we'll stick to a daily trigger
  // and rely on the 'Intensity' logic.
  // Let's make this a daily trigger and instruct the user to use Intensity '1'.
  Browser.msgBox('Bi-Weekly Trigger Note', 'Apps Script does not directly support "every 15 days" triggers. ' +
                 'Please use the "Set Up Daily Trigger" option and set the "Intensity" column to "1" (15 days) for relevant rows. ' +
                 'The script will handle the 15-day interval automatically.', Browser.Buttons.OK);
  Logger.log('User notified about bi-weekly trigger limitation. Recommending daily trigger + Intensity 1.');
  // No actual trigger created by this function, as it's handled by daily + intensity.
}


/**
 * Sets up a monthly time-driven trigger to run the automation.
 * This function is accessible from the custom menu.
 * Replaced Browser.msgBox with Logger.log for editor compatibility.
 */
function setupMonthlyTrigger() {
  ScriptApp.newTrigger('generateAndSendMessages')
      .timeBased()
      .onMonthDay(1) // Runs on the 1st of every month
      .atHour(9)     // At 9 AM (adjust as needed)
      .create();
  Logger.log('Monthly trigger set to run "generateAndSendMessages" on the 1st of every month at 9 AM.');
  Browser.msgBox('Trigger Setup', 'A monthly trigger has been set to run "generateAndSendMessages" on the 1st of every month at 9 AM.', Browser.Buttons.OK);
}

/**
 * Deletes all existing triggers for this script.
 * Useful for resetting or reconfiguring automation.
 * Replaced Browser.msgBox with Logger.log for editor compatibility.
 */
function deleteAllTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    ScriptApp.deleteTrigger(triggers[i]);
  }
  Logger.log('All existing triggers for this script have been deleted.');
  Browser.msgBox('Triggers Deleted', 'All existing triggers for this script have been deleted.', Browser.Buttons.OK);
}
