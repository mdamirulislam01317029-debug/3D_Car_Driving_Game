HIGHWAY RUSH — 3D CAR DRIVING GAME (VERSION 3.0)
=================================================

নতুন আপডেটের ফিচার
-------------------
1. Poster Start Page: গেমের প্রথম পেজে গাড়ির পোস্টার-স্টাইল কভার, গেমের নাম ও ফিচার পরিচিতি।
2. Curved Road: Three.js geometry দিয়ে আঁকাবাঁকা রাস্তা, lane divider, shoulder ও guard rail একই curve অনুসরণ করে।
3. Copyright: © 2026 AMIRUL & JAHIDUL — ALL RIGHTS RESERVED.
4. Extra Power: হলুদ Power-up সংগ্রহ করলে ১০ সেকেন্ড Turbo-তে প্রায় 331 KM/H পর্যন্ত গতি পাওয়া যায়।
5. Protection / Shield: নীল Shield সংগ্রহ করলে ১০ সেকেন্ড collision damage থেকে সুরক্ষা পাওয়া যায়।
6. User Login: Player name দিয়ে local browser profile তৈরি/লোড করা যায়। এটি demo/local profile; secure password-based account নয়।
7. Single Player: একা খেলার মোড, নিজের best score localStorage-এ সংরক্ষিত হয়।
8. Levels: ৫টি ধাপে score অনুযায়ী level বাড়ে; Valley Run, Alpine Curve, Night Sprint, Storm Highway, Legend Run। Level বাড়ার সঙ্গে traffic spawn আরও কঠিন হয় এবং আকাশ/কুয়াশা/landscape lighting theme বদলায়। শুরু করার level-ও বেছে নেওয়া যায়।
9. Multiplayer: Node.js + Express + Socket.IO room system; host room তৈরি করে ৫ অক্ষরের কোড শেয়ার করতে পারে। একই server-এ সর্বোচ্চ ৮ জন একসঙ্গে live race করতে পারে।
10. Real-time 3D: Curved 3D highway, গাড়ি, guard rail, mountain, trees, street lamps, shadow ও chase/cockpit camera।
11. আগের ফিচার: 173 KM/H normal speed, Space ধরে Turbo 274 KM/H; ছেড়ে দিলে smooth deceleration, sound, 3 lives, collision detection, score, camera toggle, pause, mobile touch controls।

চালানোর পদ্ধতি (Windows)
-------------------------
1. ZIP Extract করুন।
2. কম্পিউটারে Node.js 18 বা newer ইনস্টল করুন: https://nodejs.org/
3. 3D_Car_Driving_Game ফোল্ডারে RUN_GAME.bat ডাবল ক্লিক করুন।
4. প্রথমবার npm দিয়ে Express ও Socket.IO package install হবে (ইন্টারনেট দরকার)।
5. ব্রাউজারে http://localhost:3001 খুলবে। Command Prompt উইন্ডো চালু রাখুন।

Multiplayer কীভাবে খেলবেন
--------------------------
1. Multiplayer খেলতে প্রত্যেক খেলোয়াড়কে একই server-এ সংযুক্ত হতে হবে।
2. একই Wi-Fi/LAN-এ থাকলে host কম্পিউটারের LAN IP ব্যবহার করে অন্যরা http://HOST-LAN-IP:3001 খুলবে। Windows Firewall-এ Node.js/port 3001 অনুমতি দিতে হতে পারে।
3. একজন Player Login করে Multiplayer > Create Room চাপবে। তৈরি হওয়া ৫ অক্ষরের Room Code বন্ধুদের দেবে।
4. অন্য খেলোয়াড়রা Multiplayer > Room Code > Join চাপবে। Host Start Multiplayer Race চাপলে সবাই একসঙ্গে শুরু করবে।
5. ইন্টারনেটের মাধ্যমে দূরের বন্ধুদের সঙ্গে খেলতে server-টি Render/Railway/VPS-এর মতো public Node.js host-এ deploy করতে হবে। শুধু ZIP খুললে দূরবর্তী multiplayer স্বয়ংক্রিয়ভাবে হবে না।

Login ও Data সম্পর্কে
---------------------
- Player name browser localStorage-এ সেভ হয়। কোনো password বা sensitive login data নেওয়া হয় না।
- Best score-ও ওই browser-এ থাকে। অন্য browser/device-এ profile বা score নিজে থেকে sync হবে না।
- Multiplayer room ও player position server-এর মাধ্যমে sync হয়; এটি classroom/project demo-এর জন্য lightweight room multiplayer।

Controls
--------
A / ← : Left
D / → : Right
Space (hold) : Turbo
C : Chase / Cockpit Camera
P / Esc : Pause / Resume
Enter : Start/Login action
R : Restart (Pause/Game Over)
Mobile: LEFT / RIGHT / TURBO touch controls

Technology
----------
HTML5 · CSS3 · JavaScript ES Modules · Three.js · Node.js · Express · Socket.IO
Three.js CDN ব্যবহারের কারণে এবং প্রথমবার Node packages install করতে ইন্টারনেট প্রয়োজন।

Developed by: Amirul & Jahidul
