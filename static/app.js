// =========================
// Elements
// =========================
const sigcarEl = document.getElementById("sigcar");
const anoEl = document.getElementById("ano");
const btn = document.getElementById("btn");

const msgEl = document.getElementById("msg");

const pdfArea = document.getElementById("pdfArea");
const sourceEl = document.getElementById("source");
const btnPdf = document.getElementById("btnPdf");

const stripEl = document.getElementById("strip");
const stripPillEl = document.getElementById("stripPill");
const stripRightEl = document.getElementById("stripRight");

const summaryEl = document.getElementById("summary");
const resultArea = document.getElementById("resultArea");
const tbody = document.getElementById("tbody");
const extras = document.getElementById("extras");

// cards
const cardStatus = document.getElementById("cardStatus");
const badgeStatus = document.getElementById("badgeStatus");
const cardAreaTotal = document.getElementById("cardAreaTotal");
const cardMunicipio = document.getElementById("cardMunicipio");
const cardImovel = document.getElementById("cardImovel");

// barra + kpis
const kpiTotal = document.getElementById("kpiTotal");
const lblLegal = document.getElementById("lblLegal");
const lblIlegal = document.getElementById("lblIlegal");
const pctLegal = document.getElementById("pctLegal");
const pctIlegal = document.getElementById("pctIlegal");
const barLegal = document.getElementById("barLegal");
const barIlegal = document.getElementById("barIlegal");
const barFooterLeft = document.getElementById("barFooterLeft");
const barFooterRight = document.getElementById("barFooterRight");

// risco
const riskTag = document.getElementById("riskTag");

// =========================
// Helpers UI
// =========================
function showMsg(text, type) {
  msgEl.className = "msg " + (type === "error" ? "error" : "ok");
  msgEl.textContent = text;
  msgEl.style.display = "block";
}

function hideMsg() {
  msgEl.style.display = "none";
}

function clearTable() {
  while (tbody && tbody.firstChild) tbody.removeChild(tbody.firstChild);
  if (extras) extras.textContent = "";
}

function row(label, value) {
  const tr = document.createElement("tr");
  const td1 = document.createElement("td");
  const td2 = document.createElement("td");
  td1.textContent = label;
  td2.textContent = value ?? "";
  tr.appendChild(td1);
  tr.appendChild(td2);
  return tr;
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function fmtHa(v) {
  const n = num(v);
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + " ha";
}

function safeText(v) {
  if (v === null || v === undefined) return "—";
  const s = String(v).trim();
  return s ? s : "—";
}

// =========================
// Status badge + cor do card
// =========================
function setStatusBadge(status) {
  if (!badgeStatus) return;

  // reset
  badgeStatus.className = "badge";
  if (cardStatus) cardStatus.className = "miniCard";

  const s = String(status || "").toUpperCase();

  if (!s || s === "—") {
    badgeStatus.textContent = "—";
    return;
  }

  // AUTORIZADO
  if (s.includes("AUTORIZADO") && !s.includes("NÃO") && !s.includes("NAO")) {
    badgeStatus.textContent = "✅ AUTORIZADO";
    badgeStatus.classList.add("ok");
    if (cardStatus) cardStatus.classList.add("good");
    return;
  }

  // NÃO AUTORIZADO
  if (
    s.includes("NAO_AUTORIZADO") ||
    s.includes("NÃO_AUTORIZADO") ||
    s.includes("NÃO AUTORIZADO") ||
    s.includes("ILEGAL")
  ) {
    badgeStatus.textContent = "❌ NÃO AUTORIZADO";
    badgeStatus.classList.add("bad");
    if (cardStatus) cardStatus.classList.add("bad");
    return;
  }

  // MISTO
  if (s.includes("MISTO")) {
    badgeStatus.textContent = "⚠️ MISTO";
    badgeStatus.classList.add("warn");
    if (cardStatus) cardStatus.classList.add("warn");
    return;
  }

  // fallback
  badgeStatus.textContent = safeText(status);
  badgeStatus.classList.add("warn");
  if (cardStatus) cardStatus.classList.add("warn");
}

// =========================
// Strip (faixa grande startup)
// =========================
function renderStrip(r) {
  if (!stripEl) return;

  // esquerda: pill com status
  const status = r.status_autorizacao || r.status || r.categoria || "";
  const muni = r.municipio || "";
  const imovel = r.nom_imovel || r.nome_imovel || "";

  // pill
  if (stripPillEl) {
    const s = String(status || "").toUpperCase();
    stripPillEl.className = "pill"; // reset
    stripPillEl.textContent = safeText(status);

    if (s.includes("AUTORIZADO") && !s.includes("NÃO") && !s.includes("NAO")) {
      stripPillEl.classList.add("pillOk");
    } else if (
      s.includes("NAO_AUTORIZADO") ||
      s.includes("NÃO_AUTORIZADO") ||
      s.includes("ILEGAL")
    ) {
      stripPillEl.classList.add("pillBad");
    } else if (s.includes("MISTO")) {
      stripPillEl.classList.add("pillWarn");
    } else {
      stripPillEl.classList.add("pillNeutral");
    }
  }

  // direita: "Município • Imóvel"
  if (stripRightEl) {
    const right = [muni, imovel].filter(Boolean).join(" • ");
    stripRightEl.textContent = safeText(right);
  }

  stripEl.style.display = "flex";
}

// =========================
// Summary cards + barra + risco
// =========================
function renderSummary(r) {
  if (!summaryEl) return;

  summaryEl.style.display = "block";

  // cards
  setStatusBadge(r.status_autorizacao || r.status || r.categoria || "");
  if (cardAreaTotal) cardAreaTotal.textContent = fmtHa(r.area_desmatada_total_ha ?? 0);
  if (cardMunicipio) cardMunicipio.textContent = safeText(r.municipio);
  if (cardImovel) cardImovel.textContent = safeText(r.nom_imovel || r.nome_imovel);

  // barra legal/ilegal
  const legal = num(r.desmatamento_legal_ha);
  const ilegal = num(r.desmatamento_ilegal_ha);

  // se vier só total e não vier legal/ilegal, joga tudo como "ilegal" (pra não ficar zerado)
  let total = legal + ilegal;
  if (total <= 0) {
    total = num(r.area_desmatada_total_ha);
  }

  const pLegal = total > 0 ? (legal / total) * 100 : 0;
  const pIlegal = total > 0 ? (ilegal / total) * 100 : 0;

  if (kpiTotal) kpiTotal.innerHTML = `<strong>Total:</strong> ${fmtHa(total)}`;

  if (lblLegal) lblLegal.textContent = `Autorizado: ${fmtHa(legal)}`;
  if (lblIlegal) lblIlegal.textContent = `Não autorizado: ${fmtHa(ilegal)}`;

  if (pctLegal) pctLegal.textContent = total > 0 ? `(${pLegal.toFixed(0)}%)` : "";
  if (pctIlegal) pctIlegal.textContent = total > 0 ? `(${pIlegal.toFixed(0)}%)` : "";

  if (barLegal) barLegal.style.width = `${Math.max(0, pLegal)}%`;
  if (barIlegal) barIlegal.style.width = `${Math.max(0, pIlegal)}%`;

  if (barFooterLeft) barFooterLeft.textContent = `${pLegal.toFixed(0)}% autorizado`;
  if (barFooterRight) barFooterRight.textContent = `${pIlegal.toFixed(0)}% não autorizado`;

  // risco (simples e apresentável)
  // regra: se ilegal > 0 => ALTO, se misto => MÉDIO, se legal>0 e ilegal==0 => BAIXO
  if (riskTag) {
    riskTag.className = "riskTag"; // reset
    const s = String(r.status_autorizacao || "").toUpperCase();
    const hasIlegal = ilegal > 0;
    const hasLegal = legal > 0;

    if (hasIlegal && hasLegal) {
      riskTag.textContent = "MÉDIO (misto)";
      riskTag.classList.add("riskMid");
    } else if (hasIlegal) {
      riskTag.textContent = "ALTO (não autorizado)";
      riskTag.classList.add("riskHigh");
    } else if (s.includes("MISTO")) {
      riskTag.textContent = "MÉDIO (misto)";
      riskTag.classList.add("riskMid");
    } else if (hasLegal || s.includes("AUTORIZADO")) {
      riskTag.textContent = "BAIXO (autorizado)";
      riskTag.classList.add("riskLow");
    } else {
      riskTag.textContent = "INDEFINIDO";
      riskTag.classList.add("riskMid");
    }
  }
}

// =========================
// Details table
// =========================
function renderTable(r) {
  clearTable();

  if (!tbody) return;

  tbody.appendChild(row("SIGCAR", safeText(r.sigcar)));
  tbody.appendChild(row("Status (Autorizado?)", safeText(r.status_autorizacao)));

  if (r.ano_desmatamento !== undefined && r.ano_desmatamento !== null) {
    tbody.appendChild(row("Ano do desmatamento", safeText(r.ano_desmatamento)));
  } else if (r.ano_selecionado !== undefined && r.ano_selecionado !== null) {
    tbody.appendChild(row("Ano selecionado", safeText(r.ano_selecionado)));
  } else if (r.ano_mais_recente !== undefined && r.ano_mais_recente !== null) {
    tbody.appendChild(row("Ano mais recente", safeText(r.ano_mais_recente)));
  }

  tbody.appendChild(row("Município", safeText(r.municipio)));
  tbody.appendChild(row("Nome do imóvel", safeText(r.nom_imovel)));

  if (r.area_desmatada_total_ha !== undefined) {
    tbody.appendChild(row("Área desmatada total (ha)", fmtHa(r.area_desmatada_total_ha)));
  }
  if (r.desmatamento_legal_ha !== undefined) {
    tbody.appendChild(row("Desmatamento autorizado (ha)", fmtHa(r.desmatamento_legal_ha)));
  }
  if (r.desmatamento_ilegal_ha !== undefined) {
    tbody.appendChild(row("Desmatamento NÃO autorizado (ha)", fmtHa(r.desmatamento_ilegal_ha)));
  }
  if (r.categoria !== undefined && r.categoria !== null) {
    tbody.appendChild(row("Categoria", safeText(r.categoria)));
  }

  if (resultArea) resultArea.style.display = "block";

  // extras
  const parts = [];
  if (Array.isArray(r.anos_disponiveis) && r.anos_disponiveis.length) {
    parts.push(`Anos disponíveis: ${r.anos_disponiveis.join(", ")}`);
  }
  if (r.qtd_registros !== undefined) {
    parts.push(`Registros usados na conta: ${r.qtd_registros}`);
  }
  if (extras) extras.textContent = parts.join(" • ");
}

// =========================
// PDF
// =========================
async function generatePDF() {
  if (!pdfArea) return;

  try {
    btnPdf.disabled = true;
    btnPdf.textContent = "Gerando PDF...";

    // captura só o bloco de resultados
    const canvas = await html2canvas(pdfArea, { scale: 2 });
    const imgData = canvas.toDataURL("image/png");

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF("p", "mm", "a4");

    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();

    // mantém proporção
    const imgW = pageW;
    const imgH = (canvas.height * imgW) / canvas.width;

    let y = 0;
    let remaining = imgH;

    // multi páginas
    while (remaining > 0) {
      pdf.addImage(imgData, "PNG", 0, y, imgW, imgH);
      remaining -= pageH;
      if (remaining > 0) {
        pdf.addPage();
        y -= pageH; // sobe a imagem na página seguinte
      }
    }

    const filename = `relatorio_sigcar_${(sigcarEl.value || "").trim() || "consulta"}.pdf`;
    pdf.save(filename);
  } catch (e) {
    showMsg("Falha ao gerar PDF: " + String(e), "error");
  } finally {
    btnPdf.disabled = false;
    btnPdf.textContent = "📄 Gerar relatório em PDF";
  }
}

if (btnPdf) {
  btnPdf.addEventListener("click", generatePDF);
}

// =========================
// Main: click Consultar
// =========================
btn.addEventListener("click", async () => {
  hideMsg();

  // reset UI
  if (pdfArea) pdfArea.style.display = "none";
  if (sourceEl) sourceEl.style.display = "none";
  if (stripEl) stripEl.style.display = "none";
  if (summaryEl) summaryEl.style.display = "none";
  if (resultArea) resultArea.style.display = "none";
  clearTable();
  if (btnPdf) btnPdf.disabled = true;

  const sigcar = (sigcarEl.value || "").trim();
  const ano = (anoEl.value || "").trim();

  if (!sigcar) {
    showMsg("SIGCAR é obrigatório.", "error");
    return;
  }

  btn.disabled = true;
  btn.textContent = "Consultando...";

  try {
    const params = new URLSearchParams();
    params.set("sigcar", sigcar);
    // só manda ano se tiver valor (evita alguns backends tratarem "" diferente)
    if (ano) params.set("ano", ano);

    const res = await fetch(`/api/consulta?${params.toString()}`, { cache: "no-store" });
    const data = await res.json();

    if (!data.ok) {
      showMsg(data.erro || "Erro ao consultar.", "error");
      return;
    }

    const r = data.resultado;

    if (!r || !r.encontrado) {
      showMsg((r && r.motivo) ? r.motivo : "Não encontrado.", "error");
      return;
    }

    // mostra container resultados
    if (pdfArea) pdfArea.style.display = "block";

    // fonte (chip)
    if (sourceEl) {
      sourceEl.textContent = `🔎 Fonte consultada: ${r.fonte || "N/A"}`;
      sourceEl.style.display = "inline-flex";
    }

    // strip + summary + table
    renderStrip(r);
    renderSummary(r);
    renderTable(r);

    if (btnPdf) btnPdf.disabled = false;

    showMsg("Consulta concluída.", "ok");
  } catch (e) {
    showMsg("Falha: " + String(e), "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Consultar";
  }
});

// Enter para consultar
sigcarEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") btn.click();
});
anoEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") btn.click();
});