# Google Sheets Integration Setup Guide

Follow these steps to connect your Invoice App to Google Sheets.

## Step 1: Create a Google Sheet

1. Open [Google Sheets](https://sheets.new).
2. Name it "Invoice Database" (or anything you like).
3. In the first row, create these headers:
   - **Column A**: Date
   - **Column B**: Invoice ID
   - **Column C**: Client Name
   - **Column D**: Amount
   - **Column E**: Status
   - **Column F**: Items Summary

## Step 2: Add the Script

1. In your Google Sheet, click **Extensions** > **Apps Script**.
2. Delete any code in the editor and paste the following code:

// 1. Delete all existing code and paste this:

function doGet(e) {
return ContentService.createTextOutput("Connection Success! The Web App is ONLINE.");
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // Simple Form Data Parsing
    var data = e.parameter;

    var row = [
      data.date || new Date(),
      data.id || "NO-ID",
      data.clientName || "",
      data.amount || 0,
      data.status || "",
      data.items || ""
    ];

    sheet.appendRow(row);
    return ContentService.createTextOutput("Success").setMimeType(ContentService.MimeType.TEXT);

  } catch (e) {
    return ContentService.createTextOutput("Error: " + e.message).setMimeType(ContentService.MimeType.TEXT);
  } finally {
    lock.releaseLock();
  }
}

3. Click the **Save** icon (disk).

## Step 3: Deploy as Web App (IMPORTANT)

1. Click the blue **Deploy** button > **New deployment**.
2. Click the gear icon slightly to the left of "Select type" and choose **Web app**.
3. Fill in these details:
   - **Description**: Invoice Webhook v2
   - **Execute as**: Me (your email)
   - **Who has access**: **Anyone**
4.  **IMPORTANT**: If you are updating, you MUST look for the **"Version"** dropdown and select **"New version"**. If you leave it as "Project version", it will NOT update.
5. Click **Deploy**.
6. You might be asked to authorize. Click **Review permissions** > Choose your account > **Advanced** > **Go to (Untitled project) (unsafe)** > **Allow**.
7. Copy the **Web app URL** provided (it ends in `/exec`).

## Step 4: Connect to App

1. Open your Invoice Generator App.
2. Click the **Settings (Gear Icon)** button.
3. Paste the **Web app URL** into the field.
4. Click **Save Connection**.

Done! Now every time you save an invoice in the app, it will automatically appear in your Google Sheet.
