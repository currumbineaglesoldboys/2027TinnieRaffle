const HEADERS = ['Reference','Requested','Name','Email','Phone','Quantity','Total','Method','Status','First ticket','Last ticket','Confirmed by','Confirmed at','Email status','Follow-up notes','Last followed up','Request key'];
const METHODS = ['Bank transfer','EFTPOS at the bar','Cash at senior home games'];

// Run in the Apps Script editor. Existing settings are preserved on repeat runs.
function setupRaffle_() {
  const p = PropertiesService.getScriptProperties();
  if (!p.getProperty('SHEET_ID')) {
    const ss = SpreadsheetApp.create('Currumbin Eagles Old Boys 2027 Tinnie Raffle');
    const sh = ss.getSheets()[0];
    sh.setName('Orders'); sh.appendRow(HEADERS); sh.setFrozenRows(1);
    p.setProperty('SHEET_ID', ss.getId());
  }
  const defaults = {ADMIN_EMAIL:'currumbineaglesoldboys@gmail.com', SALES_OPEN:'false', TICKET_PRICE:'10', MAX_TICKETS:'', DRAW_LABEL:'At the Grand Final', BANK_NAME:'', ACCOUNT_NAME:'', BSB:'', ACCOUNT_NUMBER:'', PAYID:'', PUBLIC_URL:''};
  Object.keys(defaults).forEach(k => { if (p.getProperty(k) === null) p.setProperty(k, defaults[k]); });
  return p.getProperty('SHEET_ID');
}

// Set INITIAL_ADMIN_PIN in Script Properties, run once, then it is removed.
function configureAdminPin_() {
  const p = PropertiesService.getScriptProperties(), pin = p.getProperty('INITIAL_ADMIN_PIN');
  if (!pin || !/^\d{4,12}$/.test(pin)) throw Error('Set INITIAL_ADMIN_PIN to the chosen numeric PIN first.');
  const salt = Utilities.getUuid();
  p.setProperties({PIN_SALT:salt, PIN_HASH:hash_(salt + ':' + pin), AUTH_VERSION:Utilities.getUuid()});
  p.deleteProperty('INITIAL_ADMIN_PIN');
}
function props_() { return PropertiesService.getScriptProperties(); }
function hash_(s) { return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s).map(b => ('0' + ((b+256)%256).toString(16)).slice(-2)).join(''); }
function locked_(fn) { const l=LockService.getScriptLock(); l.waitLock(30000); try { return fn(); } finally { l.releaseLock(); } }
function sheet_() { return SpreadsheetApp.openById(props_().getProperty('SHEET_ID')).getSheetByName('Orders'); }
function rows_() { return sheet_().getDataRange().getValues().slice(1); }
function safe_(s) { return /^[=+@\-]/.test(s) ? "'"+s : s; }
function clean_(s) { return String(s || '').replace(/^'/,''); }
function order_(r) { return {reference:r[0], requested:String(r[1]), name:clean_(r[2]), email:clean_(r[3]), phone:clean_(r[4]), quantity:Number(r[5]), total:Number(r[6]), method:r[7], status:r[8], first:r[9], last:r[10], confirmedBy:r[11], confirmedAt:String(r[12]), emailStatus:r[13], notes:clean_(r[14]), followedUp:String(r[15])}; }
function auth_(token) {
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) throw Error('Please sign in again.');
  const p=props_(), key='SESSION_'+hash_(token), raw=p.getProperty(key), s=raw && JSON.parse(raw);
  if (!s || s.expires<Date.now() || s.version!==p.getProperty('AUTH_VERSION')) { if(raw)p.deleteProperty(key); throw Error('Please sign in again.'); }
  return s.email;
}
function login(email,pin) {
  return locked_(() => {
    const p=props_(), now=Date.now(), fail=JSON.parse(p.getProperty('LOGIN_FAILURES') || '{"count":0,"until":0}');
    if(fail.until>now) throw Error('Too many attempts. Please wait 15 minutes.');
    if(!p.getProperty('PIN_HASH')) throw Error('Admin sign-in has not been configured.');
    const valid=String(email).trim().toLowerCase()===p.getProperty('ADMIN_EMAIL') && hash_(p.getProperty('PIN_SALT')+':'+String(pin))===p.getProperty('PIN_HASH');
    if(!valid) { const count=fail.until && fail.until<=now ? 1 : fail.count+1; p.setProperty('LOGIN_FAILURES',JSON.stringify({count,until:count>=5?now+900000:0})); throw Error('Email or PIN incorrect.'); }
    p.deleteProperty('LOGIN_FAILURES');
    const token=(Utilities.getUuid()+Utilities.getUuid()).replace(/-/g,'');
    Object.keys(p.getProperties()).filter(k=>k.startsWith('SESSION_')).forEach(k=>{ try{if(JSON.parse(p.getProperty(k)).expires<now)p.deleteProperty(k);}catch(e){p.deleteProperty(k);} });
    p.setProperty('SESSION_'+hash_(token),JSON.stringify({email:p.getProperty('ADMIN_EMAIL'),expires:now+7200000,version:p.getProperty('AUTH_VERSION')}));
    return {token};
  });
}
function logout(token) { auth_(token); props_().deleteProperty('SESSION_'+hash_(token)); return true; }
function doGet(e) {
  const t=HtmlService.createTemplateFromFile('App');
  t.mode=e && e.parameter.view==='admin'?'admin':'public';
  return t.evaluate().setTitle('Currumbin Eagles Old Boys Tinnie Raffle').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
function getPublicConfig() {
  const c=props_().getProperties(), price=Number(c.TICKET_PRICE), cap=Number(c.MAX_TICKETS);
  return {open:c.SALES_OPEN==='true' && price>0 && Number.isInteger(cap) && cap>0, price:price||0, draw:c.DRAW_LABEL||'At the Grand Final', publicUrl:c.PUBLIC_URL||''};
}
function createOrder(input) {
  return locked_(() => {
    if(!input || typeof input!=='object')throw Error('Invalid order.');
    const c=getPublicConfig(), p=props_(), qty=Number(input.quantity);
    if(!c.open)throw Error('Ticket sales are not open yet.');
    if(!Number.isInteger(qty)||qty<1||qty>100)throw Error('Choose between 1 and 100 tickets.');
    const name=String(input.name||'').trim(), email=String(input.email||'').trim(), phone=String(input.phone||'').trim(), key=String(input.requestKey||'');
    if(!name||name.length>120||email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!phone||phone.length>40||!/^[a-zA-Z0-9-]{20,80}$/.test(key))throw Error('Enter your name, valid email and phone.');
    if(!METHODS.includes(input.method))throw Error('Choose a payment method.');
    if(input.method==='Bank transfer'&&!p.getProperty('PAYID')&&!(p.getProperty('ACCOUNT_NAME')&&p.getProperty('BSB')&&p.getProperty('ACCOUNT_NUMBER')))throw Error('Bank transfer details are awaiting confirmation.');
    const rows=rows_(), existing=rows.find(r=>r[16]===key);
    if(existing) {
      if(clean_(existing[3])!==email||clean_(existing[2])!==name||Number(existing[5])!==qty||existing[7]!==input.method)throw Error('This request has already been used. Start a new order.');
      return paymentInfo_(existing);
    }
    const reserved=rows.filter(r=>['Awaiting payment','Paid'].includes(r[8])).reduce((n,r)=>n+Number(r[5]),0);
    if(reserved+qty>Number(p.getProperty('MAX_TICKETS')))throw Error('Not enough tickets remain. Please contact the club.');
    let reference;
    do { reference='CE-'+Utilities.getUuid().replace(/-/g,'').slice(0,10).toUpperCase(); } while(rows.some(r=>r[0]===reference));
    const row=[reference,new Date(),safe_(name),safe_(email),safe_(phone),qty,Math.round(qty*c.price*100)/100,input.method,'Awaiting payment','','','','','Not sent','','',key];
    sheet_().appendRow(row); SpreadsheetApp.flush(); return paymentInfo_(row);
  });
}
function paymentInfo_(row) { const p=props_();return {reference:row[0], quantity:Number(row[5]), total:Number(row[6]), method:row[7], status:row[8], account:p.getProperty('ACCOUNT_NAME'), bsb:p.getProperty('BSB'), number:p.getProperty('ACCOUNT_NUMBER'), payid:p.getProperty('PAYID')}; }
function getAdminData(token) { auth_(token); const p=props_(), c=p.getProperties(); return {orders:rows_().map(order_),settings:{price:c.TICKET_PRICE,cap:c.MAX_TICKETS,draw:c.DRAW_LABEL,account:c.ACCOUNT_NAME,bsb:c.BSB,number:c.ACCOUNT_NUMBER,payid:c.PAYID,publicUrl:c.PUBLIC_URL,open:c.SALES_OPEN==='true'}}; }
function saveSettings(token,s) {
  return locked_(() => {
    auth_(token); const price=Number(s.price), cap=Number(s.cap), issued=Math.max(0,...rows_().map(r=>Number(r[10])||0));
    const reserved=rows_().filter(r=>['Awaiting payment','Paid'].includes(r[8])).reduce((n,r)=>n+Number(r[5]),0);
    if(s.price!==''&&(!Number.isFinite(price)||price<=0||Math.round(price*100)!==price*100))throw Error('Enter a price with up to two decimal places.');
    if(s.cap!==''&&(!Number.isInteger(cap)||cap<Math.max(issued,reserved,1)))throw Error('Ticket limit must cover existing orders and issued numbers.');
    if(s.open&&(!(price>0)||!(cap>0)))throw Error('Set price and ticket limit before opening sales.');
    if(s.publicUrl&&!/^https:\/\//.test(s.publicUrl))throw Error('Public page URL must start with https://');
    const pairs={TICKET_PRICE:s.price,MAX_TICKETS:s.cap,DRAW_LABEL:s.draw||'At the Grand Final',ACCOUNT_NAME:s.account,BSB:s.bsb,ACCOUNT_NUMBER:s.number,PAYID:s.payid,PUBLIC_URL:s.publicUrl,SALES_OPEN:String(Boolean(s.open))};
    Object.keys(pairs).forEach(k=>{if(String(pairs[k]).length>500)throw Error('Setting too long.');pairs[k]=String(pairs[k]);});
    props_().setProperties(pairs);return true;
  });
}
function find_(reference) { const sh=sheet_(), rows=sh.getDataRange().getValues(), i=rows.findIndex(r=>r[0]===reference);if(i<1)throw Error('Order not found.');return {sh,row:rows[i],n:i+1,rows}; }
function saveFollowUp(token,reference,note) { return locked_(()=>{auth_(token);if(typeof note!=='string'||note.length>5000)throw Error('Note too long.');const f=find_(reference);f.sh.getRange(f.n,15,1,2).setValues([[safe_(note),new Date()]]);return true;}); }
function cancelOrder(token,reference) { return locked_(()=>{auth_(token);const f=find_(reference);if(f.row[8]!=='Awaiting payment')throw Error('Only unpaid requests can be cancelled.');f.sh.getRange(f.n,9).setValue('Cancelled');return true;}); }
function confirmPayment(token,reference,method,amount) {
  return locked_(()=>{
    const actor=auth_(token), f=find_(reference), r=f.row;
    if(r[8]==='Paid')return {message:'Already confirmed. Existing ticket numbers retained.',order:order_(r)};
    if(r[8]!=='Awaiting payment')throw Error('This order is not awaiting payment.');
    if(!METHODS.includes(method))throw Error('Select how payment was received.');
    if(Math.round(Number(amount)*100)!==Math.round(Number(r[6])*100))throw Error('Received amount must match the order total.');
    const last=Math.max(0,...f.rows.slice(1).map(row=>Number(row[10])||0)), first=last+1, end=last+Number(r[5]);
    if(end>Number(props_().getProperty('MAX_TICKETS')))throw Error('Ticket limit reached.');
    f.sh.getRange(f.n,8,1,7).setValues([[method,'Paid',first,end,actor,new Date(),'Pending']]);
    SpreadsheetApp.flush();
    return sendTickets_(f.sh,f.n);
  });
}
function sendTickets_(sh,n) {
  const r=sh.getRange(n,1,1,HEADERS.length).getValues()[0];
  // Claim delivery before sending. Ambiguous/interrupted deliveries require an explicit resend.
  sh.getRange(n,14).setValue('Sending');SpreadsheetApp.flush();
  const text='Hi '+clean_(r[2])+',\n\nPayment confirmed. Thank you for supporting the Currumbin Eagles Old Boys.\n\nOrder '+r[0]+'\nTicket numbers '+r[9]+' to '+r[10]+'\nNumber of tickets '+r[5]+'\nAmount paid AUD '+Number(r[6]).toFixed(2)+'\nDraw '+(props_().getProperty('DRAW_LABEL')||'At the Grand Final')+'\n\nKeep this email as your raffle ticket record.';
  try {
    MailApp.sendEmail({to:clean_(r[3]),subject:'Your Currumbin Eagles Old Boys raffle tickets - '+r[0],body:text,name:'Currumbin Eagles Old Boys'});
    sh.getRange(n,14).setValue('Sent'); return {message:'Payment confirmed and ticket email sent.',order:order_(sh.getRange(n,1,1,HEADERS.length).getValues()[0])};
  } catch(e) { sh.getRange(n,14).setValue('Delivery uncertain');return {message:'Payment confirmed. Check delivery before retrying the email.',order:order_(sh.getRange(n,1,1,HEADERS.length).getValues()[0])}; }
}
function retryTicketEmail(token,reference) {return locked_(()=>{auth_(token);const f=find_(reference);if(f.row[8]!=='Paid')throw Error('Payment must be confirmed first.');if(f.row[13]==='Sent')throw Error('Ticket email already sent.');return sendTickets_(f.sh,f.n);});}

