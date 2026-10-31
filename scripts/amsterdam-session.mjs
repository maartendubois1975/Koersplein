export const marketDate = (now = new Date()) => new Intl.DateTimeFormat('en-CA', {timeZone:'Europe/Amsterdam', year:'numeric', month:'2-digit', day:'2-digit'}).format(now);

export const sessionCutoffHour = 20;

export const marketHour = (now = new Date()) => Number(new Intl.DateTimeFormat('en-GB', {timeZone:'Europe/Amsterdam',hour:'2-digit',hourCycle:'h23'}).format(now));
