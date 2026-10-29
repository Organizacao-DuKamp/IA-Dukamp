import { fold } from "./book.ts";

export function completionText(text: string) {
  return fold(text)
    .replace(/[, ]*\b(?:ta|ok|viu|beleza)[?!. ]*$/i, "")
    .trim();
}
export function completionIntent(text: string): "strong" | "ack" | null {
  const t = completionText(text);
  if (
    /\?|\b(?:nao|ainda nao|vou|irei|quero saber|como|posso|preciso terminar|talvez|se eu|vizinh[oa]|disse|falou|suponha|simul\w*)\b|["“”]/.test(
      t,
    )
  )
    return null;
  if (
    /\b(?:tarefa|lembrete)\s+(?:(?:ja|esta|ficou)\s+)*(?:feito|feita|concluido|concluida|finalizado|finalizada)\b/.test(
      t,
    ) ||
    /\b(?:conclui|terminei|finalizei|acabei de fazer|ja fiz|ja dei racao|ja alimentei|dei racao|alimentei|ja pesei|ja vacinei|ja consertei|ja limpei|ja fechei|agronomo ja veio)\b/.test(
      t,
    ) ||
    /\b(?:concluir|conclua|conclui[ar]|finalizar|finalize|dar baixa|de baixa|marque.*(?:feita|concluida))\b.*\b(?:tarefa|lembrete)\b/.test(
      t,
    )
  )
    return "strong";
  return /^(?:sim|ja|feito|pronto|concluida|terminei|ja esta feito|sim[, ]+ja fiz)[.! ]*$/.test(t)
    ? "ack"
    : null;
}
export function completionTokens(text: string) {
  const t = completionText(text)
    .replace(/\b(?:aliment\w*|racao|racoes|cocho|trato)\b/g, " alimentacao ")
    .replace(/\b(?:pesar|pesei|pesagem|pesado)\b/g, " pesagem ")
    .replace(/\b(?:vacinar|vacinei|vacinacao)\b/g, " vacinacao ")
    .replace(/\b(?:limpar|limpei|limpeza)\b/g, " limpeza ")
    .replace(/\b(?:consertar|consertei|conserto|reparar|reparei)\b/g, " reparo ");
  const ignored = new Set(
    "eu ja sim nao a o os as de da do das dos pelo pela pelos pelas pro pros pras pra ficou gado gados bovinos animais animal novos novas de da do das dos em na no nas nos para pra por com que essa esse esta este aquela aquele tarefa tarefas lembrete lembretes conclui concluir conclua concluida concluidas concluido concluidos terminei terminar finalizada finalizadas finalizei fiz feito feita feitas pronto prontos acabei fazer dei dar baixa marque como hoje ontem agora bom dia boa tarde noite tpec tepec zepec mim eles elas todos todas meus minhas minha meu fazenda alimentar".split(
      " ",
    ),
  );
  return [...new Set(t.split(/[^\p{L}\d]+/u).filter((x) => x.length > 1 && !ignored.has(x)))];
}
export function naturalTaskReminder(message: string) {
  return message.replace(
    /Se sim, responda [“"]concluir tarefa [^”"\n]+[”"]\.?\s*$/,
    "Pode responder “já fiz” ou dizer qual atividade terminou.",
  );
}
