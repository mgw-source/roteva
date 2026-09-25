# ChatFlow

A small real-time direct-message app built with React, Vite, Express, Socket.IO, and SQLite.

## Requirements

- Node.js 20.19+ or 22.12+
- npm

## First-time setup

Open two terminals in the project folder.

In the first terminal, install and start the server:

```powershell
cd server
npm.cmd install
npm.cmd run dev
```

In the second terminal, install and start the client:

```powershell
cd client
npm.cmd install
npm.cmd run dev
```

Open the Vite URL printed in the client terminal, usually `http://localhost:5173`.

The server creates `server/data/chatflow.sqlite` on first start. For local development it uses a built-in JWT secret; before deployment, copy `server/.env.example` to `server/.env` and set a long, random `JWT_SECRET`.

## Included features

- Create an account and log in with a bcrypt-hashed password.
- Search for users and start one-to-one conversations.
- Send and receive Socket.IO messages saved in SQLite.
- Load recent conversation history after signing in or refreshing.
- Log out and return to the login screen.

The development server proxies API and Socket.IO requests to Express, so no extra frontend environment file is needed.