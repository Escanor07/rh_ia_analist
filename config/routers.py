class AuthRouter:
    AUTH_APPS = {"auth", "authtoken", "contenttypes"}

    def db_for_read(self, model, **hints):
        if model._meta.app_label in self.AUTH_APPS:
            return "auth_db"
        return "default"

    def db_for_write(self, model, **hints):
        if model._meta.app_label in self.AUTH_APPS:
            return "auth_db"
        return "default"

    def allow_relation(self, obj1, obj2, **hints):
        return True

    def allow_migrate(self, db, app_label, **hints):
        if app_label in self.AUTH_APPS:
            return db == "auth_db"
        return db == "default"
