let ultimoResultado = null;
let ultimoSigcar = "";
let ultimoAno = "";

// cadeia de custódia
let reportId = "";
let evidenciasPack = null;        // objeto final que será baixado
let evidenciasHashHex = "";       // SHA-256 do JSON baixado

const $ = (id) => document.getElementById(id);

function showMsg(type, text){
  const msg = $("msg");
  msg.className = "msg " + (type === "ok" ? "ok" : "error");
  msg.textContent = text;
  msg.style.display = "block";
}

function hideMsg(){
  const msg = $("msg");
  msg.style.display = "none";
}

// evita "Invalid Date"
function formatISOToBR(iso){
  if(!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR");
}

function toUTCStampForId(iso){
  // cria um carimbo curto para ID (mesmo se iso vier estranho)
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return new Date().toISOString().replace(/[:.]/g,"").slice(0,15) + "Z";
  return d.toISOString().replace(/[:.]/g,"").slice(0,15) + "Z";
}

function randomSuffix(len=6){
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  for(let i=0;i<len;i++) out += chars[arr[i] % chars.length];
  return out;
}

function buildReportId(sigcar, consultaEmUtc){
  // SIGCAR-456145-20260226T174501Z-AB12CD
  const stamp = toUTCStampForId(consultaEmUtc).replace("Z",""); // já termina com Z no final abaixo
  const y = stamp.slice(0,4);
  const m = stamp.slice(4,6);
  const d = stamp.slice(6,8);
  const hh = stamp.slice(9,11);
  const mm = stamp.slice(11,13);
  const ss = stamp.slice(13,15);
  const compact = `${y}${m}${d}T${hh}${mm}${ss}Z`;
  return `SIGCAR-${sigcar}-${compact}-${randomSuffix(6)}`;
}

function setBadgeStatus(status){
  const b = $("badgeStatus");
  b.textContent = status || "—";
  b.classList.remove("ok","bad","warn");
  if(status === "AUTORIZADO") b.classList.add("ok");
  else if(status === "NÃO_AUTORIZADO") b.classList.add("bad");
  else if(status === "MISTO") b.classList.add("warn");
}

function buildTable(resultado){
  const tbody = $("tbody");
  tbody.innerHTML = "";

  const rows = [
    ["SIGCAR", resultado.sigcar ?? "—"],
    ["Status", resultado.status_autorizacao ?? "—"],
    ["Ano selecionado", (resultado.ano_selecionado ?? "—")],
    ["Município", resultado.municipio ?? "—"],
    ["Nome do imóvel", resultado.nom_imovel ?? "—"],
    ["Área desmatada total (ha)", (resultado.area_desmatada_total_ha ?? "—") + (resultado.area_desmatada_total_ha != null ? " ha" : "")],
    ["Desmatamento autorizado (ha)", (resultado.desmatamento_legal_ha ?? "—") + (resultado.desmatamento_legal_ha != null ? " ha" : "")],
    ["Desmatamento NÃO autorizado (ha)", (resultado.desmatamento_ilegal_ha ?? "—") + (resultado.desmatamento_ilegal_ha != null ? " ha" : "")],
    ["Fonte consultada", resultado.fonte ?? "—"],
    ["Data/hora da consulta (UTC)", resultado.consulta_em_utc ?? "—"],
    ["Versão", resultado.versao ?? "—"],
  ];

  for(const [k,v] of rows){
    const tr = document.createElement("tr");
    const td1 = document.createElement("td");
    const td2 = document.createElement("td");
    td1.textContent = k;
    td2.textContent = String(v);
    tr.appendChild(td1);
    tr.appendChild(td2);
    tbody.appendChild(tr);
  }

  const extras = $("extras");
  if(resultado.anos_disponiveis && Array.isArray(resultado.anos_disponiveis) && resultado.anos_disponiveis.length){
    extras.textContent = `Anos disponíveis: ${resultado.anos_disponiveis.join(", ")} • Registros usados na conta: ${resultado.qtd_registros ?? "—"}`;
  }else{
    extras.textContent = `Registros usados na conta: ${resultado.qtd_registros ?? "—"}`;
  }
}

function preencherProporcaoERisco(resultado){
  const total = Number(resultado.area_desmatada_total_ha ?? 0);
  const legal = Number(resultado.desmatamento_legal_ha ?? 0);
  const ilegal = Number(resultado.desmatamento_ilegal_ha ?? 0);

  const pctLegal = total > 0 ? (legal / total) * 100 : 0;
  const pctIlegal = total > 0 ? (ilegal / total) * 100 : 0;

  $("proporcaoArea").style.display = "block";

  $("chipTotal").textContent = `Total: ${total.toFixed(2)} ha`;
  $("chipLegal").textContent = `Autorizado: ${legal.toFixed(2)} ha (${pctLegal.toFixed(0)}%)`;
  $("chipIlegal").textContent = `Não autorizado: ${ilegal.toFixed(2)} ha (${pctIlegal.toFixed(0)}%)`;

  $("barLegal").style.width = `${Math.max(0, Math.min(100, pctLegal))}%`;
  $("barIlegal").style.width = `${Math.max(0, Math.min(100, pctIlegal))}%`;

  $("txtLegal").textContent = `${pctLegal.toFixed(0)}% autorizado`;
  $("txtIlegal").textContent = `${pctIlegal.toFixed(0)}% não autorizado`;

  // risco baseado no status
  const badgeRisco = $("badgeRisco");
  badgeRisco.classList.remove("ok","warn","bad");

  let riscoTxt = "—";
  if (resultado.status_autorizacao === "AUTORIZADO") {
    riscoTxt = "BAIXO (autorizado)";
    badgeRisco.classList.add("ok");
  } else if (resultado.status_autorizacao === "MISTO") {
    riscoTxt = "MÉDIO (misto)";
    badgeRisco.classList.add("warn");
  } else if (resultado.status_autorizacao === "NÃO_AUTORIZADO") {
    riscoTxt = "ALTO (não autorizado)";
    badgeRisco.classList.add("bad");
  }
  badgeRisco.textContent = riscoTxt;
}

function getEnvLabel(){
  const h = location.hostname || "";
  if (h === "127.0.0.1" || h === "localhost") return "local";
  return "produção";
}

function toHex(buffer){
  const bytes = new Uint8Array(buffer);
  let hex = "";
  for(const b of bytes) hex += b.toString(16).padStart(2,"0");
  return hex;
}

async function sha256Hex(text){
  const enc = new TextEncoder();
  const data = enc.encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return toHex(hash);
}

function setCustodyUI(){
  // chips
  $("reportIdChip").style.display = reportId ? "inline-flex" : "none";
  $("reportId").textContent = reportId || "";

  $("hashChip").style.display = evidenciasHashHex ? "inline-flex" : "none";
  $("hashShort").textContent = evidenciasHashHex ? (evidenciasHashHex.slice(0,12) + "…") : "";

  // rodapé (entra no PDF)
  $("reportFooter").style.display = reportId ? "block" : "none";
  $("footerReportId").textContent = reportId || "—";
  $("footerHash").textContent = evidenciasHashHex ? (evidenciasHashHex.slice(0,16) + "…") : "—";
  $("footerVersion").textContent = (ultimoResultado && ultimoResultado.versao) ? String(ultimoResultado.versao) : "—";
  $("footerEnv").textContent = getEnvLabel();
}

async function prepararEvidenciasECriptoHash(){
  // busca evidências e cria o “pacote” que será baixado (com meta)
  const url = `/api/evidencias?sigcar=${encodeURIComponent(ultimoSigcar)}&ano=${encodeURIComponent(ultimoAno)}`;
  const resp = await fetch(url);
  const data = await resp.json();

  if(!resp.ok || !data.ok){
    evidenciasPack = null;
    evidenciasHashHex = "";
    setCustodyUI();
    return;
  }

  const meta = {
    report_id: reportId,
    sigcar: ultimoSigcar,
    ano: ultimoAno || null,
    consulta_em_utc: (ultimoResultado && ultimoResultado.consulta_em_utc) ? ultimoResultado.consulta_em_utc : null,
    fonte: (ultimoResultado && ultimoResultado.fonte) ? ultimoResultado.fonte : null,
    versao: (ultimoResultado && ultimoResultado.versao) ? ultimoResultado.versao : null,
    ambiente: getEnvLabel(),
    gerado_em_utc: new Date().toISOString()
  };

  evidenciasPack = {
    meta,
    evidencias: data.resultado
  };

  const jsonStr = JSON.stringify(evidenciasPack, null, 2);
  evidenciasHashHex = await sha256Hex(jsonStr);

  setCustodyUI();
}

function buildResumoTexto(){
  const r = ultimoResultado || {};
  const total = r.area_desmatada_total_ha ?? "—";
  const legal = r.desmatamento_legal_ha ?? "—";
  const ilegal = r.desmatamento_ilegal_ha ?? "—";

  const linhas = [
    "RELATÓRIO TÉCNICO AUTOMATIZADO — SIGCAR/TO (Consolidação de dados públicos)",
    "",
    `ID do Relatório: ${reportId || "—"}`,
    `SHA-256 (evidências JSON): ${evidenciasHashHex || "—"}`,
    "",
    `SIGCAR: ${r.sigcar ?? "—"}`,
    `Imóvel: ${r.nom_imovel ?? "—"}`,
    `Município: ${r.municipio ?? "—"}`,
    `Ano selecionado: ${r.ano_selecionado ?? "—"}`,
    `Status: ${r.status_autorizacao ?? "—"}`,
    `Área total (ha): ${total}`,
    `Autorizado (ha): ${legal}`,
    `Não autorizado (ha): ${ilegal}`,
    "",
    `Fonte consultada: ${r.fonte ?? "—"}`,
    `Consulta (UTC): ${r.consulta_em_utc ?? "—"}`,
    `Versão: ${r.versao ?? "—"} • Ambiente: ${getEnvLabel()}`,
    "",
    "Nota: Resultado automatizado a partir de bases públicas (ArcGIS/TO). Não substitui perícia ambiental oficial."
  ];

  return linhas.join("\n");
}

async function copiarResumo(){
  const txt = buildResumoTexto();
  try{
    await navigator.clipboard.writeText(txt);
    showMsg("ok", "Resumo copiado. Cole no documento/petição.");
  }catch{
    // fallback
    window.prompt("Copie o texto abaixo:", txt);
  }
}

async function consultar(){
  hideMsg();
  const sigcar = $("sigcar").value.trim();
  const ano = $("ano").value.trim();

  if(!sigcar){
    showMsg("err", "SIGCAR é obrigatório.");
    return;
  }

  $("btn").disabled = true;

  try{
    const url = `/api/consulta?sigcar=${encodeURIComponent(sigcar)}&ano=${encodeURIComponent(ano)}`;
    const resp = await fetch(url);
    const data = await resp.json();

    if(!resp.ok || !data.ok){
      showMsg("err", data.erro || "Falha na consulta.");
      return;
    }

    const resultado = data.resultado;
    ultimoResultado = resultado;
    ultimoSigcar = sigcar;
    ultimoAno = ano;

    // cria ID do relatório (fixo nessa consulta)
    reportId = buildReportId(sigcar, resultado.consulta_em_utc || new Date().toISOString());
    evidenciasPack = null;
    evidenciasHashHex = "";

    // some o bloco inicial
    const preInfo = $("preInfo");
    if (preInfo) preInfo.style.display = "none";

    // mostra resultado
    $("pdfArea").style.display = "block";
    $("summary").style.display = "block";
    $("resultArea").style.display = "block";

    // chips topo
    $("source").style.display = "inline-flex";
    $("source").textContent = `🔎 Fonte: ${resultado.fonte || "—"}`;

    $("consultaEm").style.display = "inline-flex";
    $("consultaEm").textContent = `🕒 Consulta: ${formatISOToBR(resultado.consulta_em_utc || "")} (UTC)`;

    // cards
    setBadgeStatus(resultado.status_autorizacao);

    $("cardAreaTotal").textContent =
      (resultado.area_desmatada_total_ha ?? "—") + (resultado.area_desmatada_total_ha != null ? " ha" : "");

    $("cardMunicipio").textContent = resultado.municipio ?? "—";
    $("cardImovel").textContent = resultado.nom_imovel ?? "—";

    // cor do card status
    const cardStatus = $("cardStatus");
    cardStatus.classList.remove("good","warn","bad");
    if(resultado.status_autorizacao === "AUTORIZADO") cardStatus.classList.add("good");
    else if(resultado.status_autorizacao === "MISTO") cardStatus.classList.add("warn");
    else if(resultado.status_autorizacao === "NÃO_AUTORIZADO") cardStatus.classList.add("bad");

    // tabela
    buildTable(resultado);

    // barra + risco
    preencherProporcaoERisco(resultado);

    // enable buttons
    $("btnPdf").disabled = false;
    $("btnEvidence").disabled = false;
    $("btnCopy").disabled = false;

    // atualiza UI do reportId (hash ainda será calculado)
    setCustodyUI();

    // pré-calcula hash das evidências (para já aparecer na tela e entrar no PDF)
    await prepararEvidenciasECriptoHash();

    showMsg("ok", "Consulta concluída.");
  }catch(err){
    console.error(err);
    showMsg("err", "Erro ao consultar. Verifique sua conexão e tente novamente.");
  }finally{
    $("btn").disabled = false;
  }
}

async function baixarEvidencias(){
  if(!ultimoSigcar) return;

  // se ainda não preparou, prepara agora (garante hash + pacote)
  if(!evidenciasPack || !evidenciasHashHex){
    await prepararEvidenciasECriptoHash();
  }

  if(!evidenciasPack){
    showMsg("err", "Não foi possível obter as evidências.");
    return;
  }

  // garante que o arquivo baixado = hash exibido
  const jsonStr = JSON.stringify(evidenciasPack, null, 2);
  const blob = new Blob([jsonStr], {type: "application/json"});
  const a = document.createElement("a");
  const ts = new Date().toISOString().replaceAll(":","-");
  a.href = URL.createObjectURL(blob);
  a.download = `evidencias_SIGCAR_${ultimoSigcar}_${ts}_ID-${reportId}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();

  setCustodyUI();
}

/**
 * PDF VISUAL (print do #pdfArea)
 * inclui: chips + ID + hash + cards + barra + risco + tabela + rodapé técnico
 */
async function gerarPDF(){
  if(!ultimoResultado) return;

  const target = $("pdfArea");
  if(!target){
    showMsg("err", "Não encontrei a área do resultado (pdfArea).");
    return;
  }

  try{
    if (typeof html2canvas === "undefined") {
      showMsg("err", "html2canvas não carregou. Verifique o script no index.html.");
      return;
    }

    // garante hash preenchido antes do PDF
    if(!evidenciasHashHex){
      await prepararEvidenciasECriptoHash();
    }

    if (document.fonts && document.fonts.ready) {
      try { await document.fonts.ready; } catch {}
    }

    const canvas = await html2canvas(target, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#0b1220",
      logging: false,
      onclone: (clonedDoc) => {
        clonedDoc.body.style.background = "#0b1220";
        const el = clonedDoc.getElementById("pdfArea");
        if (!el) return;
        el.querySelectorAll("*").forEach((node) => {
          node.style.backdropFilter = "none";
          node.style.webkitBackdropFilter = "none";
        });
      }
    });

    const imgData = canvas.toDataURL("image/png", 1.0);
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF("p", "mm", "a4");

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const imgProps = pdf.getImageProperties(imgData);
    const imgWidth = pageWidth;
    const imgHeight = (imgProps.height * imgWidth) / imgProps.width;

    let y = 0;
    let remaining = imgHeight;

    while (remaining > 0) {
      pdf.addImage(imgData, "PNG", 0, -y, imgWidth, imgHeight);
      remaining -= pageHeight;
      y += pageHeight;
      if (remaining > 0) pdf.addPage();
    }

    const fileName = `Relatorio_SIGCAR_${ultimoResultado.sigcar || "sem_sigcar"}_${new Date().toISOString().slice(0,10)}_ID-${reportId}.pdf`;
    pdf.save(fileName);
  }catch(e){
    console.error(e);
    showMsg("err", "Falha ao gerar PDF visual. Abra o Console (F12) para ver o erro.");
  }
}

// Eventos
$("btn").addEventListener("click", consultar);
$("btnPdf").addEventListener("click", gerarPDF);
$("btnEvidence").addEventListener("click", baixarEvidencias);
$("btnCopy").addEventListener("click", copiarResumo);