---
title: ConnectSphere Backend
emoji: 🚀
colorFrom: blue
colorTo: purple
sdk: docker
pinned: false
---

# ConnectSphere Backend Service

This is the microservice backend for ConnectSphere, handling heavy computations like Speech Analytics.
It is automatically deployed via GitHub Actions from the main repository.

## Features
- Words Per Minute (WPM) Calculation
- Filler Word Detection
- Pace Consistency Analysis

## Running Locally

1. `npm install`
2. `node index.js`

Runs on port `7860` by default.
