import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

export default async function TodosPage() {
  const supabase = await createClient();
  const { data: todos, error } = await supabase
    .from("todos")
    .select("id, name");

  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-12">
        <h1 className="text-2xl font-semibold">Todos</h1>
        <p className="mt-4 text-red-700" role="alert">
          Could not load todos: {error.message}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="text-2xl font-semibold">Todos</h1>
      {todos.length ? (
        <ul className="mt-5 list-disc space-y-2 pl-5">
          {todos.map((todo) => (
            <li key={todo.id}>{todo.name}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-foreground/65">No todos yet.</p>
      )}
    </main>
  );
}
