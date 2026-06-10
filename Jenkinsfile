pipeline {
    agent any

    options {
        timestamps()
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '20'))
    }

    environment {
        DEPLOY_HOST = '82.156.132.43'
        DEPLOY_USER = 'root'
        DEPLOY_DIR = '/opt/complass-frontend'
        DEPLOY_SSH_CREDENTIALS_ID = 'jenkins'
    }

    stages {
        stage('Install Dependencies') {
            steps {
                script {
                    if (isUnix()) {
                        sh '''
                            set -eux
                            npm ci
                        '''
                    } else {
                        bat '''
                            npm ci
                        '''
                    }
                }
            }
        }

        stage('Run Tests') {
            steps {
                script {
                    if (isUnix()) {
                        sh '''
                            set -eux
                            node --test "tests/*.test.mjs"
                        '''
                    } else {
                        bat '''
                            node --test "tests/*.test.mjs"
                        '''
                    }
                }
            }
        }

        stage('Build Frontend') {
            steps {
                script {
                    if (isUnix()) {
                        sh '''
                            set -eux
                            npm run build
                        '''
                    } else {
                        bat '''
                            npm run build
                        '''
                    }
                }
            }
        }

        stage('Deploy To Server') {
            when {
                expression { env.GERRIT_EVENT_TYPE ? env.GERRIT_EVENT_TYPE == 'change-merged' : true }
            }
            steps {
                sshagent(credentials: [env.DEPLOY_SSH_CREDENTIALS_ID]) {
                    sh '''
                        set -eux

                        ssh -o StrictHostKeyChecking=no "${DEPLOY_USER}@${DEPLOY_HOST}" "
                            set -eux
                            cd ${DEPLOY_DIR}
                            git checkout -- . 2>/dev/null || true
                            git stash clear 2>/dev/null || true
                            git fetch origin dev
                            git reset --hard origin/dev
                            docker build -t complass-frontend:latest .
                            docker compose up -d
                            docker compose ps
                            sleep 5
                            curl -f --max-time 10 --retry 3 --retry-delay 3 http://127.0.0.1:80/
                        "
                    '''
                }
                sh '''
                    curl -s -X POST "https://sctapi.ftqq.com/SCT357126TkY7NT14gipcfiCUmAc7z49Lz.send" -d "title=Jenkins 部署成功" -d "desp=前端服务已部署" >/dev/null || true
                '''
            }
        }
    }
}
