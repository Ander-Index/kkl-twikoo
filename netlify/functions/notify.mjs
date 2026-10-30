function response(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  })
}

function cleanMessage(value) {
  let message = value.replace(/\r\n?/g, "\n")
  message = message.replace(/^(评论人：[^\n]*?)(?:\s+\[[^\]\n]*\]\(mailto:[^\)\n]+\)|\s+\([^\(\)\n]*@[^\(\)\n]*\))(?=\n|$)/gm, "$1")
  message = message.replace(/^评论人IP：[^\n]*(?:\n|$)/gm, "")
  message = message.replace(/\n{3,}/g, "\n\n")
  message = message.replace(/^([^\n]*有新评论了)\n(?!\n)/, "$1\n\n")
  return message.trim()
}

export default async (request) => {
  if (request.method !== "POST") return response(405, { retcode: 405, message: "Method Not Allowed" })

  const url = new URL(request.url)
  const authorization = request.headers.get("authorization") || ""
  const credential = url.searchParams.get("access_token") || authorization.replace(/^Bearer\s+/i, "")
  if (!process.env.NOTIFY_TOKEN || credential !== process.env.NOTIFY_TOKEN) {
    return response(401, { retcode: 401, message: "Unauthorized" })
  }

  let body
  try {
    body = await request.json()
  } catch {
    return response(400, { retcode: 400, message: "Invalid JSON" })
  }
  if (!body || typeof body.message !== "string") {
    return response(400, { retcode: 400, message: "Missing message" })
  }

  const origin = (process.env.NAPCAT_ORIGIN || "").replace(/\/+$/, "")
  const token = process.env.NAPCAT_TOKEN
  const groupId = process.env.NAPCAT_GROUP_ID
  if (!origin || !token || !groupId) {
    return response(500, { retcode: 500, message: "Notification service is not configured" })
  }

  try {
    const upstream = await fetch(`${origin}/send_group_msg?group_id=${encodeURIComponent(groupId)}&access_token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ group_id: Number(groupId), message: cleanMessage(body.message) }),
      signal: AbortSignal.timeout(5000)
    })
    const result = await upstream.json()
    return response(upstream.status, result)
  } catch {
    return response(502, { retcode: 502, message: "NapCat request failed" })
  }
}
