import { Hono } from 'hono'
import { handle } from 'hono/vercel'

const app = new Hono().basePath('/api')

app.post('/auth/login_with_password', async (c) => {
  const { handle: loginHandle } = await import('../endpoints/auth/login_with_password_POST.js')
  return loginHandle(c.req.raw)
})

app.get('/auth/session', async (c) => {
  const { handle: sessionHandle } = await import('../endpoints/auth/session_GET.js')
  return sessionHandle(c.req.raw)
})

app.post('/auth/logout', async (c) => {
  const { handle: logoutHandle } = await import('../endpoints/auth/logout_POST.js')
  return logoutHandle(c.req.raw)
})

app.get('/attendance/overview', async (c) => {
  const { handle: overviewHandle } = await import('../endpoints/attendance/overview_GET.js')
  return overviewHandle(c.req.raw)
})

app.get('/attendance/employee', async (c) => {
  const { handle: empHandle } = await import('../endpoints/attendance/employee_GET.js')
  return empHandle(c.req.raw)
})

app.post('/attendance/incident', async (c) => {
  const { handle: incidentHandle } = await import('../endpoints/attendance/incident_POST.js')
  return incidentHandle(c.req.raw)
})

app.post('/attendance/incident_update', async (c) => {
  const { handle: updateHandle } = await import('../endpoints/attendance/incident_update_POST.js')
  return updateHandle(c.req.raw)
})

export default handle(app)
