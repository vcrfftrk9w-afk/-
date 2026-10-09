package app.umnik;

/** «Мозг» Умника: бесплатный ИИ прямо в телефоне (Gemma) или Claude по ключу. Методы блокирующие. */
interface Mind {
    /** Вопрос в беседе — со снимком экрана (jpeg) или без. Текст ответа по мере прихода отдаётся в listener. */
    String ask(Brain.Chat chat, String question, byte[] jpeg, String context, Brain.Listener listener) throws Brain.Failure;

    /** Короткий разовый ответ без беседы: напоминание о перерыве, сам-подсказка по экрану. */
    String once(String system, String text, byte[] jpeg, int maxTokens) throws Brain.Failure;

    /** имя для заголовка окна: «Gemma 4 · бесплатно», «Opus 5.5» */
    String title();
}
