import {parse} from 'acorn';

// Interpret a small data-only JavaScript subset. Never eval downloaded scripts.
export function readData(source, initial = {}, stopAtHeader = false) {
  const env = Object.assign(Object.create(null), initial);
  let budget = 2000000;
  const forbidden = new Set(['__proto__', 'prototype', 'constructor']);
  function ref(n) {
    if(n.type === 'Identifier') return [env, n.name];
    if(n.type !== 'MemberExpression') throw Error('Unsupported assignment');
    const obj = run(n.object), key = n.computed ? run(n.property) : n.property.name;
    if(forbidden.has(String(key)) || obj == null) throw Error('Invalid member '+key);
    return [obj,key];
  }
  function run(n) {
    if(!n) return undefined;
    if(--budget < 0) throw Error('Source instruction limit');
    switch(n.type) {
      case 'Program': case 'BlockStatement': {for(const s of n.body) {const r=run(s);if(r?.control) return r;} return;}
      case 'EmptyStatement': return;
      case 'Literal': return n.value;
      case 'Identifier': if(n.name==='undefined') return undefined; if(!(n.name in env)) throw Error('Unknown identifier '+n.name); return env[n.name];
      case 'ArrayExpression': return n.elements.map(x=>run(x));
      case 'ObjectExpression': {const o=Object.create(null);for(const p of n.properties){const k=p.key.name??p.key.value;if(forbidden.has(k))throw Error('Invalid key');o[k]=run(p.value);}return o;}
      case 'ExpressionStatement': return run(n.expression);
      case 'SequenceExpression': {let r;for(const e of n.expressions)r=run(e);return r;}
      case 'VariableDeclaration': for(const d of n.declarations)env[d.id.name]=run(d.init);return;
      case 'MemberExpression': {const [o,k]=ref(n);return o[k];}
      case 'AssignmentExpression': {const [o,k]=ref(n.left),v=run(n.right);if(n.operator==='=')o[k]=v;else o[k]=binary(n.operator.slice(0,-1),o[k],v);return o[k];}
      case 'UpdateExpression': {const [o,k]=ref(n.argument),v=o[k];o[k]+=n.operator==='++'?1:-1;return n.prefix?o[k]:v;}
      case 'BinaryExpression': return binary(n.operator,run(n.left),run(n.right));
      case 'LogicalExpression': {const v=run(n.left);return n.operator==='&&'?(v&&run(n.right)):(v||run(n.right));}
      case 'UnaryExpression': {const v=run(n.argument);if(n.operator==='!')return !v;if(n.operator==='-')return -v;if(n.operator==='+')return +v;if(n.operator==='~')return ~v;if(n.operator==='void')return undefined;throw Error('Unary '+n.operator);}
      case 'ConditionalExpression': return run(run(n.test)?n.consequent:n.alternate);
      case 'IfStatement': return run(run(n.test)?n.consequent:n.alternate);
      case 'ForStatement': {run(n.init);while(!n.test||run(n.test)){const r=run(n.body);if(r?.control==='break')break;run(n.update);}return;}
      case 'WhileStatement': while(run(n.test)){if(run(n.body)?.control==='break')break;}return;
      case 'BreakStatement': return {control:'break'};
      case 'SwitchStatement': {const v=run(n.discriminant);let active=false;for(const c of n.cases){if(c.test===null||run(c.test)===v)active=true;if(active)for(const s of c.consequent)if(run(s)?.control==='break')return;}return;}
      case 'CallExpression': {
        if(n.callee.type==='Identifier'&&['hd','w','b','ft'].includes(n.callee.name))return {control:'render'};
        const args=n.arguments.map(run);
        if(n.callee.type==='Identifier'&&n.callee.name==='parseInt')return parseInt(...args);
        if(n.callee.type==='MemberExpression'){
          const key=n.callee.computed?run(n.callee.property):n.callee.property.name;
          if(n.callee.object.name==='Math'&&['floor','ceil','round','min','max','abs'].includes(key))return Math[key](...args);
          const obj=run(n.callee.object);
          if(typeof obj==='string'&&['fontcolor','bold','small','big','italics','fontsize'].includes(key))return obj;
          if(Array.isArray(obj)&&['slice','concat','push','reverse','join'].includes(key))return Array.prototype[key].apply(obj,args);
          if(typeof obj==='string'&&['substring','slice','charAt','indexOf','split','toUpperCase','toLowerCase'].includes(key))return String.prototype[key].apply(obj,args);
        }
        throw Error('Unsupported call '+source.slice(n.start,n.end).slice(0,70));
      }
      default: throw Error('Unsupported syntax '+n.type);
    }
  }
  function binary(op,a,b){switch(op){case '+':return a+b;case '-':return a-b;case '*':return a*b;case '/':return a/b;case '%':return a%b;case '|':return a|b;case '&':return a&b;case '^':return a^b;case '<<':return a<<b;case '>>':return a>>b;case '==':return a==b;case '!=':return a!=b;case '===':return a===b;case '!==':return a!==b;case '<':return a<b;case '>':return a>b;case '<=':return a<=b;case '>=':return a>=b;default:throw Error('Operator '+op);}}
  const tree=parse(source,{ecmaVersion:2020,allowReturnOutsideFunction:true});
  for(const stmt of tree.body){const r=run(stmt);if(stopAtHeader&&r?.control==='render')break;}
  return env;
}

export function table(source,name) {
  const start=source.indexOf(name+'=');
  if(start<0)throw Error('Missing table '+name);
  // The table is the first expression; following UI code is not interpreted.
  const tree=parse(source.slice(start),{ecmaVersion:2020});
  return readData(source.slice(start,start+tree.body[0].end),{A:10,B:11,C:12,D:13,E:14,F:15,SS:35})[name];
}

export function chartData(html, difficulty) {
  const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).filter(x=>/\bsp\s*[=\[]/.test(x));
  if(!scripts.length)throw Error('Chart script missing');
  return readData(scripts.join('\n').replace(/<!--|-->/g,''),{
    s:'?D'+({NORMAL:'N',HYPER:'H',ANOTHER:'A',LEGGENDARIA:'X'}[difficulty])+'A01',
    k:0,a:difficulty==='ANOTHER'||difficulty==='LEGGENDARIA'?1:0,l:difficulty==='NORMAL'?1:0,kuro:difficulty==='LEGGENDARIA'?1:0,
    hps:['NORMAL','HYPER'].includes(difficulty)?1:0,g:0,pty:0,m:0,key:14,hs:1,gap:1,LNDEF:384,
    sp:[],dp:[],ln:[],tc:[],c1:[],c2:[],cn:[],sc32:[],sc32base:[],sc32loop:[],hcn:0,notes:0,measure:0,soflan:0,genre:'',title:'',artist:'',bpm:'',memo:'',lnse:'',lnhs:''
  },true);
}

