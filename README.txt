OBEDY WORLD MOVIE BANK — GitHub/Netlify package

FILES:
- index.html
- netlify/functions/movies.mjs
- netlify.toml
- package.json

IMPORTANT:
1. Upload these files and folders to the ROOT of the GitHub repository. Do not upload this ZIP as the only file.
2. Connect the GitHub repository to Netlify (Build settings: publish directory . ; functions directory netlify/functions).
3. In Netlify: Site configuration > Environment variables, add ADMIN_PIN with a private PIN chosen by you. Never share it in chat.
4. Trigger a new deploy. Netlify Blobs will store the movie list centrally; it is not browser localStorage.
5. The admin form currently accepts public poster and watch/order URLs. Direct phone-gallery video upload and payment verification are NOT included yet; those need a separate storage/payment provider setup.
6. Add only movies you own or are authorized to distribute.
7. Keep API secrets out of GitHub and frontend files.
