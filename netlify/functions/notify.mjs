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

const NAPCAT_ORIGIN = "http://192.3.216.192:61001"

export default async (request) => {
  if (request.method !== "POST") return response(405, { retcode: 405, message: "Method Not Allowed" })

  const url = new URL(request.url)
  const authorization = request.headers.get("authorization") || ""
  const credential = url.searchParams.get("access_token") || authorization.replace(/^Bearer\s+/i, "")
  const groupId = url.searchParams.get("target_group")
  if (!credential) return response(401, { retcode: 401, message: "Unauthorized" })
  if (!groupId || !/^\d+$/.test(groupId)) {
    return response(400, { retcode: 400, message: "Invalid target_group" })
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

  try {
    const upstream = await fetch(`${NAPCAT_ORIGIN}/send_group_msg?group_id=${encodeURIComponent(groupId)}&access_token=${encodeURIComponent(credential)}`, {
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
