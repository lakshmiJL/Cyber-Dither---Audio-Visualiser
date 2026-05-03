# CYBER-DITHER DEPLOYMENT GUIDE 

Follow these steps to deploy your visualizer to GitHub Pages from scratch.

## 1. Prerequisites
*   **Node.js**: Ensure you have Node.js installed.
*   **Git**: Ensure Git is installed and configured with your GitHub account.

## 2. Initial Project Setup
If you are starting with a fresh copy of the code:
```bash
# 1. Install all dependencies
npm install

# 2. Generate the music tracks (Important for first build)
python3 generate_music.py
```

## 3. GitHub Repository Setup
1.  Go to [github.com/new](https://github.com/new).
2.  Create a new repository named `Cyber-Dither---Audio-Visualiser`.
3.  **Do not** initialize with README or license (keep it empty).

## 4. Connecting & Pushing
In your terminal, run these commands inside your project folder:
```bash
# 1. Initialize Git
git init

# 2. Add your GitHub as the "origin"
# (Replace YOUR_USERNAME with your actual GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/Cyber-Dither---Audio-Visualiser.git

# 3. Add and Commit your files
git add .
git commit -m "Initial Deployment"

# 4. Push to GitHub (This triggers the automatic deployment)
git push -u origin master
```

## 5. Finalizing GitHub Settings
1.  Go to your repository on GitHub.
2.  Go to **Settings** > **Pages**.
3.  Under **Build and deployment** > **Source**, ensure it is set to **"GitHub Actions"**.
4.  Wait for the **Actions** tab to show a green checkmark next to "Deploy to GitHub Pages".

## 6. Accessing Your Site
Your site will be live at:
`https://YOUR_USERNAME.github.io/Cyber-Dither---Audio-Visualiser/`

---

### Troubleshooting Tips:
*   **404 Errors**: Ensure your `vite.config.js` has `base: './'` set correctly.
*   **Audio Not Playing**: Ensure you ran the `python3 generate_music.py` script before pushing, so the audio files actually exist in the `public/audio` folder.
*   **Actions Failing**: Check the "Actions" tab on GitHub for specific error messages.
