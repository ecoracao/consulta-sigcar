import requests
from typing import Optional, Dict, Any, List

# =========================
# BASES PRINCIPAIS (URLs)
# =========================

URL_DESM_LEGAL = (
    "https://services5.arcgis.com/bFkySEj8QRiLvNJ0/arcgis/rest/services/"
    "desmatamento_legal/FeatureServer/0/query"
)

URL_DESM_ILEGAL = (
    "https://services5.arcgis.com/bFkySEj8QRiLvNJ0/arcgis/rest/services/"
    "desmatamento_ilegal/FeatureServer/0/query"
)

URL_IMOVEIS_23_24 = (
    "https://services5.arcgis.com/bFkySEj8QRiLvNJ0/arcgis/rest/services/"
    "Imoveis_alerta_23_24/FeatureServer/0/query"
)


# ==================================================
# FUNÇÃO UTILITÁRIA PARA CONSULTA NO ARCGIS REST
# ==================================================
def arcgis_query(url: str, where: str, out_fields="*") -> List[dict]:
    params = {
        "f": "json",
        "where": where,
        "outFields": out_fields,
        "returnGeometry": "false",
        "resultRecordCount": 2000,
    }

    r = requests.get(url, params=params, timeout=60)
    r.raise_for_status()
    data = r.json()

    return data.get("features", [])


# ==================================================
# FUNÇÃO PRINCIPAL (USADA PELO SITE)
# ==================================================
def consultar_sigcar(sigcar: str, ano: Optional[int] = None) -> Dict[str, Any]:
    sigcar = str(sigcar).strip()

    # -----------------------------
    # 1) TENTA NA SEÇÃO IV PRIMEIRO
    # -----------------------------
    where = f"numero_car = '{sigcar}'"

    legal = arcgis_query(URL_DESM_LEGAL, where)
    ilegal = arcgis_query(URL_DESM_ILEGAL, where)

    registros = legal + ilegal

    # Se encontrou algo na seção IV
    if registros:
        areas_legais = []
        areas_ilegais = []
        anos = set()
        municipio = None
        nom_imovel = None

        for f in registros:
            a = f["attributes"]

            # captura campos principais
            municipio = a.get("municipio") or a.get("Município") or municipio
            nom_imovel = a.get("nom_imovel") or a.get("Nome_do_Im") or nom_imovel

            # área desmatada
            if a.get("desm_LEGAL"):
                areas_legais.append(float(a["desm_LEGAL"]))

            if a.get("desm_ILEGA"):
                areas_ilegais.append(float(a["desm_ILEGA"]))

            # ano
            if a.get("Ano"):
                try:
                    anos.add(int(a["Ano"]))
                except:
                    pass

        area_legal = round(sum(areas_legais), 2)
        area_ilegal = round(sum(areas_ilegais), 2)
        area_total = round(area_legal + area_ilegal, 2)

        anos_lista = sorted(list(anos))
        ano_mais_recente = max(anos_lista) if anos_lista else None

        # Se o usuário informou um ano, filtramos
        if ano:
            if ano in anos_lista:
                ano_retorno = ano
            else:
                ano_retorno = None
        else:
            ano_retorno = ano_mais_recente

        # Define status
        if area_legal > 0 and area_ilegal == 0:
            status = "AUTORIZADO"
        elif area_ilegal > 0 and area_legal == 0:
            status = "NÃO_AUTORIZADO"
        else:
            status = "MISTO"

        return {
            "sigcar": sigcar,
            "encontrado": True,
            "fonte": "desmatamento_legal / desmatamento_ilegal (Seção IV)",
            "status_autorizacao": status,
            "area_desmatada_total_ha": area_total,
            "desmatamento_legal_ha": area_legal,
            "desmatamento_ilegal_ha": area_ilegal,
            "anos_disponiveis": anos_lista,
            "ano_mais_recente": ano_mais_recente,
            "ano_selecionado": ano_retorno,
            "municipio": municipio,
            "nom_imovel": nom_imovel,
            "qtd_registros": len(registros),
        }

    # ----------------------------------------------------
    # 2) FALLBACK: SEÇÃO "Imoveis_alerta_23_24"
    # ----------------------------------------------------
    where = f"numero_car = '{sigcar}'"
    imoveis = arcgis_query(URL_IMOVEIS_23_24, where)

    if imoveis:
        a = imoveis[0]["attributes"]

        area_legal = round(float(a.get("desm_LEGAL", 0) or 0), 2)
        area_ilegal = round(float(a.get("desm_ILEGA", 0) or 0), 2)
        area_total = round(area_legal + area_ilegal, 2)

        categoria = a.get("categoria")

        return {
            "sigcar": sigcar,
            "encontrado": True,
            "fonte": "Imoveis_alerta_23_24 (fallback do painel)",
            "status_autorizacao": "MISTO" if area_legal and area_ilegal else
                                    "AUTORIZADO" if area_legal else
                                    "NÃO_AUTORIZADO" if area_ilegal else
                                    "SEM_REGISTRO_NO_PAINEL_IV",
            "area_desmatada_total_ha": area_total,
            "desmatamento_legal_ha": area_legal,
            "desmatamento_ilegal_ha": area_ilegal,
            "ano_desmatamento": None,  # não há ano explícito nesse layer
            "municipio": a.get("municipio"),
            "nom_imovel": a.get("nom_imovel"),
            "categoria": categoria,
            "qtd_registros": len(imoveis),
        }

    # ----------------------------------------------------
    # 3) NÃO ENCONTRADO EM NENHUMA BASE RELEVANTE
    # ----------------------------------------------------
    return {
        "sigcar": sigcar,
        "encontrado": False,
        "motivo": "SIGCAR não encontrado nos layers da seção IV nem no Imoveis_alerta_23_24.",
    }
