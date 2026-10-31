const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const DATA = path.join(ROOT, 'data');
const UPLOADS = process.env.VERCEL
  ? path.join('/tmp', 'edubridge-uploads')
  : path.join(ROOT, 'uploads');
for (const dir of [DATA, UPLOADS]) fs.mkdirSync(dir, { recursive: true });
const files = { users: 'users.json', doubts: 'doubts.json', resources: 'resources.json', sessions: 'sessions.json', exchanges: 'exchanges.json', reports: 'reports.json', messages: 'messages.json' };
function read(name) { const p = path.join(DATA, files[name]); if (!fs.existsSync(p)) fs.writeFileSync(p, '[]'); try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return []; } }
function write(name, value) { fs.writeFileSync(path.join(DATA, files[name]), JSON.stringify(value, null, 2)); }
function id() { return crypto.randomUUID(); }
function safeUser(u) { const { password, ...safe } = u; return safe; }
function cleanText(v, max = 2000) { return String(v || '').trim().slice(0, max); }

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: process.env.SESSION_SECRET || 'edubridge-local-demo-change-me', resave: false, saveUninitialized: false, cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 1000 * 60 * 60 * 8 } }));
app.use('/uploads', express.static(UPLOADS));
app.use(express.static(path.join(ROOT, 'public')));

function auth(req, res, next) { const user = read('users').find(u => u.id === req.session.userId && u.active !== false); if (!user) return res.status(401).json({ error: 'Please sign in to continue.' }); req.user = user; next(); }
function role(...roles) { return (req, res, next) => roles.includes(req.user.role) ? next() : res.status(403).json({ error: 'You do not have permission for this action.' }); }
function uploadMiddleware(req, res, next) { upload.single('file')(req, res, err => { if (err) return res.status(400).json({ error: err.message }); next(); }); }
const storage = multer.diskStorage({ destination: UPLOADS, filename: (req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(5).toString('hex')}${path.extname(file.originalname).toLowerCase()}`) });
const upload = multer({ storage, limits: { fileSize: 12 * 1024 * 1024 }, fileFilter: (req, file, cb) => { const ext = path.extname(file.originalname).toLowerCase(); const allowed = ['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.doc', '.docx', '.ppt', '.pptx', '.txt']; cb(allowed.includes(ext) ? null : new Error('Allowed files: PDF, images, Word, PowerPoint and TXT (12 MB max).'), allowed.includes(ext)); } });

app.post('/api/register', async (req, res) => {
  const { name, email, password, role: userRole, college, department, year, interests, bio, skills, exams } = req.body;
  if (!name || !email || !password || !['student', 'mentor'].includes(userRole)) return res.status(400).json({ error: 'Name, email, password and account type are required.' });
  if (String(password).length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  const users = read('users'); if (users.some(u => u.email.toLowerCase() === String(email).toLowerCase())) return res.status(409).json({ error: 'An account with this email already exists.' });
  const user = { id: id(), name: cleanText(name, 80), email: cleanText(email, 150).toLowerCase(), password: await bcrypt.hash(password, 10), role: userRole, college: cleanText(college, 120), department: cleanText(department, 100), year: cleanText(year, 30), interests: cleanText(interests, 300), bio: cleanText(bio, 600), skills: cleanText(skills, 300), exams: cleanText(exams, 300), availability: 'Available', verified: false, createdAt: new Date().toISOString(), active: true };
  users.push(user); write('users', users); req.session.userId = user.id; res.status(201).json({ user: safeUser(user) });
});
app.post('/api/login', async (req, res) => { const users = read('users'); const user = users.find(u => u.email === String(req.body.email || '').toLowerCase()); if (!user || user.active === false || !(await bcrypt.compare(String(req.body.password || ''), user.password))) return res.status(401).json({ error: 'Email or password is incorrect.' }); if (req.body.role && req.body.role !== user.role) return res.status(403).json({ error: `This is a ${user.role} account. Choose the matching login.` }); req.session.userId = user.id; res.json({ user: safeUser(user) }); });
app.post('/api/logout', (req, res) => req.session.destroy(() => res.json({ ok: true })));
app.get('/api/me', auth, (req, res) => res.json({ user: safeUser(req.user) }));
app.patch('/api/profile', auth, (req, res) => { const users = read('users'); const u = users.find(x => x.id === req.user.id); for (const k of ['name','college','department','year','interests','bio','skills','exams','availability']) if (req.body[k] !== undefined) u[k] = cleanText(req.body[k], k === 'bio' ? 600 : 300); write('users', users); res.json({ user: safeUser(u) }); });
app.get('/api/mentors', auth, (req, res) => { const q = cleanText(req.query.q, 100).toLowerCase(); const mentors = read('users').filter(u => u.role === 'mentor' && u.active !== false).filter(u => !q || [u.name,u.college,u.department,u.skills,u.exams,u.bio].join(' ').toLowerCase().includes(q)); res.json(mentors.map(safeUser)); });
app.get('/api/mentors/:id', auth, (req, res) => { const u = read('users').find(x => x.id === req.params.id && x.role === 'mentor' && x.active !== false); if (!u) return res.status(404).json({ error: 'Mentor not found.' }); res.json(safeUser(u)); });
app.get('/api/resources', auth, (req, res) => { const q = cleanText(req.query.q, 100).toLowerCase(); const items = read('resources').filter(r => r.status === 'approved' || r.ownerId === req.user.id).filter(r => !q || [r.title,r.subject,r.description,r.ownerName].join(' ').toLowerCase().includes(q)); res.json(items.sort((a,b) => b.createdAt.localeCompare(a.createdAt))); });
app.get('/api/mentors/:id/resources', auth, (req, res) => { const items = read('resources').filter(r => r.ownerId === req.params.id && r.status === 'approved'); res.json(items.sort((a,b) => b.createdAt.localeCompare(a.createdAt))); });
app.post('/api/resources', auth, uploadMiddleware, (req, res) => { if (!req.file) return res.status(400).json({ error: 'Choose a file to upload.' }); const item = { id: id(), ownerId: req.user.id, ownerName: req.user.name, title: cleanText(req.body.title || req.file.originalname, 120), subject: cleanText(req.body.subject, 100), description: cleanText(req.body.description, 400), fileName: req.file.originalname, fileUrl: `/uploads/${req.file.filename}`, size: req.file.size, status: 'approved', createdAt: new Date().toISOString() }; const all = read('resources'); all.push(item); write('resources', all); res.status(201).json(item); });
app.get('/api/doubts', auth, (req, res) => res.json(read('doubts').sort((a,b) => b.createdAt.localeCompare(a.createdAt))));
app.post('/api/doubts', auth, (req, res) => { const { subject, question } = req.body; if (!subject || !question) return res.status(400).json({ error: 'Subject and question are required.' }); const all = read('doubts'); const d = { id: id(), userId: req.user.id, userName: req.user.name, subject: cleanText(subject, 100), question: cleanText(question, 2000), answer: '', answerBy: '', createdAt: new Date().toISOString() }; all.push(d); write('doubts', all); res.status(201).json(d); });
app.post('/api/doubts/:id/answer', auth, (req, res) => { const all = read('doubts'); const d = all.find(x => x.id === req.params.id); if (!d) return res.status(404).json({ error: 'Doubt not found.' }); if (!req.body.answer) return res.status(400).json({ error: 'Write an answer first.' }); d.answer = cleanText(req.body.answer, 2000); d.answerBy = req.user.name; d.answeredAt = new Date().toISOString(); write('doubts', all); res.json(d); });
app.get('/api/sessions', auth, (req, res) => res.json(read('sessions').filter(s => s.studentId === req.user.id || s.mentorId === req.user.id).sort((a,b) => b.createdAt.localeCompare(a.createdAt))));
app.post('/api/sessions', auth, role('student'), (req, res) => { const mentor = read('users').find(u => u.id === req.body.mentorId && u.role === 'mentor'); if (!mentor) return res.status(404).json({ error: 'Mentor not found.' }); const all = read('sessions'); const s = { id: id(), studentId: req.user.id, studentName: req.user.name, mentorId: mentor.id, mentorName: mentor.name, topic: cleanText(req.body.topic || 'General guidance', 150), preferredTime: cleanText(req.body.preferredTime, 100), status: 'Pending', createdAt: new Date().toISOString() }; all.push(s); write('sessions', all); res.status(201).json(s); });
app.patch('/api/sessions/:id', auth, role('mentor'), (req, res) => { const all = read('sessions'); const s = all.find(x => x.id === req.params.id && x.mentorId === req.user.id); if (!s) return res.status(404).json({ error: 'Session request not found.' }); if (!['Accepted','Declined','Completed'].includes(req.body.status)) return res.status(400).json({ error: 'Invalid session status.' }); s.status = req.body.status; write('sessions', all); res.json(s); });
app.get('/api/exchanges', auth, (req, res) => res.json(read('exchanges').sort((a,b) => b.createdAt.localeCompare(a.createdAt))));
app.post('/api/exchanges', auth, (req, res) => { if (!req.body.teach || !req.body.learn) return res.status(400).json({ error: 'Add both skills.' }); const all = read('exchanges'); const e = { id:id(), userId:req.user.id, userName:req.user.name, teach:cleanText(req.body.teach,100), learn:cleanText(req.body.learn,100), createdAt:new Date().toISOString() }; all.push(e); write('exchanges',all); res.status(201).json(e); });
app.post('/api/reports', auth, (req,res) => { if (!req.body.reason) return res.status(400).json({error:'Please provide a reason.'}); const all=read('reports'); const r={id:id(), reporterId:req.user.id, reporterName:req.user.name, targetId:cleanText(req.body.targetId,80), reason:cleanText(req.body.reason,1000), createdAt:new Date().toISOString()}; all.push(r); write('reports',all); res.status(201).json({ok:true}); });
app.get('/api/messages/:userId', auth, (req,res) => { const all=read('messages'); res.json(all.filter(m => (m.fromId===req.user.id && m.toId===req.params.userId)||(m.toId===req.user.id && m.fromId===req.params.userId))); });
app.post('/api/messages/:userId', auth, (req,res) => { const target=read('users').find(u=>u.id===req.params.userId && u.active!==false); if(!target) return res.status(404).json({error:'User not found.'}); const all=read('messages'); const m={id:id(),fromId:req.user.id,fromName:req.user.name,toId:target.id,body:cleanText(req.body.body,1500),createdAt:new Date().toISOString()}; if(!m.body) return res.status(400).json({error:'Message cannot be empty.'}); all.push(m); write('messages',all); res.status(201).json(m); });
app.use((req,res,next)=>{ if(req.path.startsWith('/api/')) return res.status(404).json({error:'API route not found.'}); next(); });
app.get('*', (req,res)=>res.sendFile(path.join(ROOT,'public','index.html')));
app.listen(PORT,()=>console.log(`EduBridge running at http://localhost:${PORT}`));
