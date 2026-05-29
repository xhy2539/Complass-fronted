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
        DEPLOY_SSH_CREDENTIALS_ID = 'prod-server-ssh'
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
                expression { env.GERRIT_EVENT_TYPE == 'change-merged' }
            }
            steps {
                sshagent(credentials: [env.DEPLOY_SSH_CREDENTIALS_ID]) {
                    sh '''
                        set -eux

                        ssh -o StrictHostKeyChecking=no "${DEPLOY_USER}@${DEPLOY_HOST}" "
                            set -eux
                            cd ${DEPLOY_DIR}
                            git pull --ff-only
                            docker build --no-cache -t complass-frontend:latest .
                            docker compose up -d
                            docker compose ps
                            curl -f http://127.0.0.1:80/
                        "
                    '''
                }
            }
        }
    }
}
