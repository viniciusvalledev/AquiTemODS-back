import axios from "axios";

// Interface para a resposta da BrasilAPI
interface BrasilApiData {
  municipio: string;
  uf: string;
  situacao_cadastral: string;
  porte: string; // Adicionar este campo
  opcao_pelo_mei: boolean;
}

class CnpjService {
  private apiURL = "https://brasilapi.com.br/api/cnpj/v1/";

  public async consultarCnpj(cnpj: string): Promise<BrasilApiData> {
    const cnpjLimpo = cnpj.replace(/\D/g, "");

    // --- ADICIONE ESTA LINHA PARA DEPURAR ---
    console.log(
      `[CnpjService] CNPJ recebido: "${cnpj}", CNPJ limpo para API: "${cnpjLimpo}"`
    );
    // -----------------------------------------

    try {
      const response = await axios.get<BrasilApiData>(
        `${this.apiURL}${cnpjLimpo}`
      );
      return response.data;
    } catch (error: any) {
      if (axios.isAxiosError(error) && error.response) {
        if (error.response.status === 400) {
          const errorMessage =
            error.response.data?.message || "formato inválido";
          throw new Error(
            `CNPJ com ${errorMessage} Por favor, verifique os dígitos.`
          );
        }
        if (error.response.status === 404) {
          throw new Error(
            "CNPJ não encontrado na base de dados da Receita Federal."
          );
        }
      }
      console.error(
        "[CnpjService - BrasilAPI] Erro Inesperado:",
        error.message
      );
      throw new Error(
        "O serviço de consulta de CNPJ está indisponível. Tente novamente mais tarde."
      );
    }
  }
}

export default new CnpjService();
