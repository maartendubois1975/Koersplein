export const marketDate = (now = new Date()) => new Intl.DateTimeFormat('en-CA', {timeZone:'Europe/Amsterdam', year:'numeric', month:'2-digit', day:'2-digit'}).format(now);
