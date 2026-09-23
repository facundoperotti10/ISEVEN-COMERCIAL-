/**
 * Supabase devuelve como máximo 1000 filas por consulta. Esta función pagina
 * hasta traer todas, así el CRM y los exports muestran todos los contactos
 * aunque la tabla crezca.
 */
export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  pageSize = 1000
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await page(from, from + pageSize - 1);
    if (error || !data) break;
    all.push(...data);
    if (data.length < pageSize) break;
  }
  return all;
}
