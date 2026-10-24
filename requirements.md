# Freelancer Invoices:

## Resume:

Freelance Invoices app is an app that keeps tracks of hours work on projects for client.

### Requirements:

    - User must be able to create a Client
        - Client must have:
            - ID
            - Name
            - Contact email
            - Contact email
            - Billing Hour(This is going to be the fallback but the project should allow to set an individual billing hour too)
    - User must be able to create a project within the Client but is not required, the projects must be stand alone
        - Project must have:
            - ID
            - Name
            - Client -> Optional
            - Description -> optional
            - Billing Hour -> Optional
    - Payment Platform:
        - Company
        - Fee
    - User should be able to fill hours into that project
    - Each record is per project
    - Each record has:
        - ID
        - Client
        - Project Name
        - Description
        - Hours Worked
        - Date
    - The app will take the records, group them and create a downloable pdf, but also a link to send the invoice as a text on email
    - The flow is the following:
        - Each week a new week of work is open
            - on each open week, the user can add records per project
            - Each week must be shown as a range in a title for instance, the week 19-10-2026 to 25-10-2026 Saturday and Sunday must appear in a different gray color but allow the insertion of records.
            - Then the user can add a record example:
                - Client: The client
                - Project: The project
                - Description: Added 5 new features to web app
                - Hours worked: 5.5 (could be double or int)
                - Date: the current day the person is adding the record
            - The UI will look like a week calendar, showing Monday thrught friday
            - On each day use can add work records
            - The week can be "close" and no other insertion might be added
            - Then the user can generate an invoice of that week of work
            - The program should be smart enough to tell if in the week of work are more than one client and split the bill into each client
            - The app should be smart enought to warn the user if there are not a minimun of 40 hours worked
            - when the user clicks on create invoice, the app allow the user to download each pdf per client, but also, to click ona link to send the invoice as a Email Text including the tables of each worked project per client.
            - If user work in week and in week worked in three projects, A,B and C, project A and B belongs to Client A, and Project C to Client B, the program should show, as result, two links, same for the pdfs
        - The user should be able to see how much has it earn by project, and by client.
        - When the total of each project hours is given, the user might want to select the fee from a platform, for instance, Payoneer takes 1%, so we need Payment methods per Client
        - User should be able to change from light to dark theme

## Architecture

    - Use model, Repository, Service and Controller paradigm for this
    - Separate the frontend and the backend in folders

# Tech stack

    - Postgrest SQL
    - Nuxt 4
    - Prime Vue with Material Theme
    - Tailwind

## Design

    - Check: .claude/design
    - Each folder Represents a view
    - .claude/design/DESIGN.md is for tokens.

## Future

    - This app will be uploaded to a TrueNAs Nas so should be prepare to be dockerize -> This is future, yet, must be done with this in consideration
