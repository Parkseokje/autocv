import type { ActionFunctionArgs } from "@remix-run/node";
import { Form } from "@remix-run/react";

export async function action({ request }: ActionFunctionArgs) {
  console.log("--- test.tsx action CALLED ---");
  const formData = await request.formData();
  const message = formData.get("message");
  console.log("Message from form:", message);
  return new Response(`Action processed in test.tsx! Message: ${message}`, { status: 200 });
}

export default function TestRoute() {
  return (
    <div style={{ fontFamily: "system-ui, sans-serif", lineHeight: "1.8", padding: "20px" }}>
      <h1>Test Action Route</h1>
      <Form method="post">
        <input type="text" name="message" defaultValue="Hello from test form" />
        <button type="submit">Submit to Test Action</button>
      </Form>
    </div>
  );
}
